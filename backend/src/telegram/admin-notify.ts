import { prisma } from "@dior/database";
import { ADMIN_ROLES } from "@dior/shared";
import { escapeTelegramHtml, sendTelegramMessage } from "./bot";

function panelUrl(path: string, admin = true): string {
  const base = (
    admin
      ? process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_APP_URL
      : process.env.NEXT_PUBLIC_APP_URL
  )?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getConfiguredAdminChatIds(): string[] {
  const ids: string[] = [];
  const single = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (single) ids.push(single);
  const list = process.env.TELEGRAM_ADMIN_CHAT_IDS?.split(",") ?? [];
  for (const id of list) {
    const trimmed = id.trim();
    if (trimmed) ids.push(trimmed);
  }
  return [...new Set(ids)];
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

/** Sends to TELEGRAM_ADMIN_CHAT_ID, or to each admin with linked Telegram if chat id is unset */
export async function notifyHostingAdmins(html: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;

  const configured = getConfiguredAdminChatIds();
  const sent = new Set<string>();

  for (const chatId of configured) {
    const result = await sendTelegramMessage(chatId, html, { parse_mode: "HTML" });
    if (result.ok) sent.add(chatId);
    else console.warn("[telegram] admin chat notify failed:", chatId, result.reason);
  }

  if (configured.length > 0) return;

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

export async function notifyAdminsTopUpPaid(params: {
  topUpId: string;
  userId: string;
  amount: number;
  provider: string;
  referenceCode: string;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const link = panelUrl(`/payments?topup=${params.topUpId}`);
  await notifyHostingAdmins(
    `💰 <b>Wallet top-up completed</b>\n` +
      `Amount: <b>$${params.amount.toFixed(2)}</b>\n` +
      `Provider: ${escapeTelegramHtml(params.provider)}\n` +
      `Ref: <code>${escapeTelegramHtml(params.referenceCode)}</code>\n` +
      `User: ${who}\n` +
      `<a href="${link}">Open payments</a>`,
  );
}

export async function notifyAdminsManualTopUpPending(params: {
  topUpId: string;
  userId: string;
  amount: number;
  referenceCode: string;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const link = panelUrl(`/payments?topup=${params.topUpId}&manual=true`);
  await notifyHostingAdmins(
    `🏦 <b>Manual transfer — review</b>\n` +
      `Amount: <b>$${params.amount.toFixed(2)}</b>\n` +
      `Ref: <code>${escapeTelegramHtml(params.referenceCode)}</code>\n` +
      `User: ${who}\n` +
      `<a href="${link}">Review in admin</a>`,
  );
}

export async function notifyAdminsNewTicket(params: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const preview = escapeTelegramHtml(params.body.trim().slice(0, 280));
  const link = panelUrl(`/support/${params.ticketId}`, false);
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
  const link = panelUrl(`/support/${params.ticketId}`, false);
  await notifyHostingAdmins(
    `💬 <b>Ticket reply from client</b>\n` +
      `<b>${escapeTelegramHtml(params.subject)}</b>\n` +
      `User: ${who}\n` +
      `${preview}${params.body.length > 200 ? "…" : ""}\n` +
      `<a href="${link}">Open ticket</a>`,
  );
}
