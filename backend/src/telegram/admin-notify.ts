import { prisma } from "@dior/database";
import { ADMIN_ROLES } from "@dior/shared";
import { escapeTelegramHtml, sendTelegramMessage } from "./bot";

function panelUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    process.env.NEXT_PUBLIC_APP_URL
  )?.replace(/\/$/, "");
  if (!base) return path;
  const controlPath = path.startsWith("/control") ? path : `/control${path.startsWith("/") ? path : `/${path}`}`;
  return `${base}${controlPath}`;
}

function parseChatIdList(...sources: (string | undefined)[]): string[] {
  const ids: string[] = [];
  for (const source of sources) {
    if (!source?.trim()) continue;
    for (const part of source.split(",")) {
      const trimmed = part.trim();
      if (trimmed) ids.push(trimmed);
    }
  }
  return [...new Set(ids)];
}

/** Telegram chat IDs for general admin alerts. */
function getAdminNotifyChatIds(): string[] {
  return parseChatIdList(
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
  );
}

/** Telegram chat IDs for payment alerts — PAYMENT_NOTIFY_TELEGRAM_IDS overrides admin list. */
function getPaymentNotifyChatIds(): string[] {
  const dedicated = parseChatIdList(process.env.PAYMENT_NOTIFY_TELEGRAM_IDS);
  if (dedicated.length > 0) return dedicated;
  return getAdminNotifyChatIds();
}

function getDiscordWebhookUrls(): string[] {
  return parseChatIdList(
    process.env.DISCORD_WEBHOOK_URL,
    process.env.DISCORD_PAYMENT_WEBHOOK_URL,
    process.env.DISCORD_ADMIN_WEBHOOK_URL,
  );
}

async function getUserLabel(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, telegramUsername: true },
  });
  if (!user) return userId.slice(0, 8);
  if (user.email) return user.email;
  if (user.telegramUsername) return `@${user.telegramUsername}`;
  return userId.slice(0, 8);
}

async function sendTelegramToChatIds(chatIds: string[], html: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;

  const sent = new Set<string>();
  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(chatId, html, { parse_mode: "HTML" });
    if (result.ok) sent.add(chatId);
    else console.warn("[telegram] notify failed:", chatId, result.reason);
  }

  if (chatIds.length > 0) return;

  const admins = await prisma.user.findMany({
    where: {
      role: { in: [...ADMIN_ROLES] },
      telegramId: { not: null },
    },
    select: { telegramId: true },
  });

  for (const admin of admins) {
    if (!admin.telegramId) continue;
    const chatId = admin.telegramId.toString();
    if (sent.has(chatId)) continue;
    const result = await sendTelegramMessage(chatId, html, { parse_mode: "HTML" });
    if (result.ok) sent.add(chatId);
  }
}

async function sendDiscordToWebhooks(
  webhooks: string[],
  payload: { content: string; embeds?: Array<Record<string, unknown>> },
): Promise<void> {
  for (const url of webhooks) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn("[discord] webhook failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("[discord] webhook error:", err);
    }
  }
}

export async function notifyHostingAdmins(html: string): Promise<void> {
  await sendTelegramToChatIds(getAdminNotifyChatIds(), html);
}

export async function notifyPaymentAdmins(params: {
  title: string;
  lines: string[];
  link?: string;
  linkLabel?: string;
}) {
  const whoLines = params.lines.map((l) => escapeTelegramHtml(l)).join("\n");
  const link = params.link ? panelUrl(params.link) : undefined;

  const tgHtml =
    `<b>${escapeTelegramHtml(params.title)}</b>\n` +
    `${whoLines}\n` +
    (link ? `<a href="${link}">${escapeTelegramHtml(params.linkLabel ?? "Open in panel")}</a>` : "");

  await sendTelegramToChatIds(getPaymentNotifyChatIds(), tgHtml);

  const discordLines = params.lines.join("\n");
  const discordContent = `**${params.title}**\n${discordLines}`;
  const embeds = link
    ? [{ title: params.linkLabel ?? "Open in panel", url: link, color: 0x3b82f6 }]
    : undefined;

  await sendDiscordToWebhooks(getDiscordWebhookUrls(), {
    content: discordContent.slice(0, 2000),
    embeds,
  });
}

export async function notifyAdminsTopUpPaid(params: {
  topUpId: string;
  userId: string;
  amount: number;
  provider: string;
  referenceCode: string;
}) {
  const who = await getUserLabel(params.userId);
  await notifyPaymentAdmins({
    title: "💰 Balance top-up completed",
    lines: [
      `Amount: $${params.amount.toFixed(2)}`,
      `Provider: ${params.provider}`,
      `Ref: ${params.referenceCode}`,
      `User: ${who}`,
    ],
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: "View top-up",
  });
}

export async function notifyAdminsManualTopUpPending(params: {
  topUpId: string;
  userId: string;
  amount: number;
  referenceCode: string;
}) {
  const who = await getUserLabel(params.userId);
  await notifyPaymentAdmins({
    title: "🏦 Manual transfer — review required",
    lines: [
      `Amount: $${params.amount.toFixed(2)}`,
      `Ref: ${params.referenceCode}`,
      `User: ${who}`,
    ],
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: "Review top-up",
  });
}

export async function notifyAdminsNewTicket(params: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const preview = escapeTelegramHtml(params.body.trim().slice(0, 280));
  const link = panelUrl(`/support/${params.ticketId}`);
  await notifyHostingAdmins(
    `🎫 <b>New support ticket</b>\n` +
      `<b>${escapeTelegramHtml(params.subject)}</b>\n` +
      `User: ${who}\n` +
      `${preview}${params.body.length > 280 ? "…" : ""}\n` +
      `<a href="${link}">Open ticket</a>`,
  );
}

export async function notifyAdminsTicketReply(params: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const preview = escapeTelegramHtml(params.body.trim().slice(0, 200));
  const link = panelUrl(`/support/${params.ticketId}`);
  await notifyHostingAdmins(
    `💬 <b>Ticket reply from client</b>\n` +
      `<b>${escapeTelegramHtml(params.subject)}</b>\n` +
      `User: ${who}\n` +
      `${preview}${params.body.length > 200 ? "…" : ""}\n` +
      `<a href="${link}">Open ticket</a>`,
  );
}
