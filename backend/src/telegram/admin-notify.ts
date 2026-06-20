import { prisma } from "@dior/database";
import { ADMIN_ROLES, DEFAULT_REFERRAL_PERCENT } from "@dior/shared";
import { escapeTelegramHtml, sendTelegramMessage } from "./bot";

const NOTIFY_DIVIDER = "────────────────";

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatProviderLabel(provider: string): string {
  return provider
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPremiumTelegramMessage(params: {
  headline: string;
  sections: Array<{ label: string; value: string }>;
  link?: string;
  linkLabel?: string;
}): string {
  const body = params.sections
    .map(
      (section) =>
        `<b>${escapeTelegramHtml(section.label)}</b>\n${escapeTelegramHtml(section.value)}`,
    )
    .join(`\n\n${NOTIFY_DIVIDER}\n\n`);

  const link = params.link ? panelUrl(params.link) : undefined;

  return (
    `<b>${escapeTelegramHtml(params.headline)}</b>\n` +
    `${NOTIFY_DIVIDER}\n\n` +
    `${body}` +
    (link
      ? `\n\n${NOTIFY_DIVIDER}\n<a href="${link}">${escapeTelegramHtml(params.linkLabel ?? "Open in panel")}</a>`
      : "")
  );
}

function panelUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    process.env.NEXT_PUBLIC_APP_URL
  )?.replace(/\/$/, "");
  if (!base) return path;
  const controlPath = path.startsWith("/control")
    ? path
    : `/control${path.startsWith("/") ? path : `/${path}`}`;
  return `${base}${controlPath}`;
}

function parseIdList(...sources: (string | undefined)[]): string[] {
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

/** Explicit Telegram chat IDs from env (primary admin notify list). */
function getConfiguredAdminChatIds(): string[] {
  return parseIdList(
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
  );
}

/** User IDs whose linked Telegram accounts receive admin alerts. */
function getConfiguredAdminUserIds(): string[] {
  return parseIdList(process.env.TELEGRAM_ADMIN_USER_IDS);
}

/** Payment-only chat IDs — when set, overrides the general admin list for top-ups. */
function getPaymentNotifyChatIds(): string[] {
  const dedicated = parseIdList(process.env.PAYMENT_NOTIFY_TELEGRAM_IDS);
  if (dedicated.length > 0) return dedicated;
  return getConfiguredAdminChatIds();
}

function getDiscordWebhookUrls(): string[] {
  return parseIdList(
    process.env.DISCORD_WEBHOOK_URL,
    process.env.DISCORD_PAYMENT_WEBHOOK_URL,
    process.env.DISCORD_ADMIN_WEBHOOK_URL,
  );
}

async function resolveTelegramIdsFromUserIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, telegramId: { not: null } },
    select: { telegramId: true },
  });

  return users
    .map((u) => u.telegramId?.toString())
    .filter((id): id is string => Boolean(id));
}

/** Resolve Telegram chat IDs for admin alerts (explicit list only, with optional fallback). */
export async function resolveAdminNotifyChatIds(scope: "all" | "payment" = "all"): Promise<string[]> {
  const explicitChatIds = scope === "payment" ? getPaymentNotifyChatIds() : getConfiguredAdminChatIds();
  const fromUsers = await resolveTelegramIdsFromUserIds(getConfiguredAdminUserIds());

  const combined = [...new Set([...explicitChatIds, ...fromUsers])];
  if (combined.length > 0) return combined;

  if (process.env.TELEGRAM_ADMIN_NOTIFY_FALLBACK === "false") {
    console.warn("[telegram] admin notify skipped — no TELEGRAM_ADMIN_CHAT_IDS configured");
    return [];
  }

  const admins = await prisma.user.findMany({
    where: {
      role: { in: [...ADMIN_ROLES] },
      telegramId: { not: null },
    },
    select: { telegramId: true },
  });

  return admins
    .map((a) => a.telegramId?.toString())
    .filter((id): id is string => Boolean(id));
}

/** Panel user IDs that receive in-app admin alerts (matches Telegram admin list when possible). */
export async function resolveAdminNotifyUserIds(): Promise<string[]> {
  const configured = getConfiguredAdminUserIds();
  if (configured.length > 0) return configured;

  const explicitChatIds = new Set(getConfiguredAdminChatIds());
  if (explicitChatIds.size > 0) {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: [...ADMIN_ROLES] },
        telegramId: { not: null },
      },
      select: { id: true, telegramId: true },
    });
    const matched = admins
      .filter((a) => a.telegramId && explicitChatIds.has(a.telegramId.toString()))
      .map((a) => a.id);
    if (matched.length > 0) return matched;
  }

  if (process.env.TELEGRAM_ADMIN_NOTIFY_FALLBACK === "false") {
    return [];
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
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

async function sendTelegramToAdminList(
  html: string,
  scope: "all" | "payment" = "all",
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.warn("[telegram] admin notify skipped — TELEGRAM_BOT_TOKEN not set");
    return;
  }

  const chatIds = await resolveAdminNotifyChatIds(scope);
  if (chatIds.length === 0) return;

  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(chatId, html, { parse_mode: "HTML" });
    if (!result.ok) {
      console.warn("[telegram] admin notify failed:", chatId, result.reason);
    }
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
  await sendTelegramToAdminList(html, "all");
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

  await sendTelegramToAdminList(tgHtml, "payment");

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

export async function notifyAdminsTopUpCreated(params: {
  topUpId: string;
  userId: string;
  amount: number;
  provider: string;
  referenceCode: string;
  status: string;
}) {
  const who = await getUserLabel(params.userId);
  const title =
    params.status === "MANUAL_REVIEW"
      ? "🏦 New manual top-up request"
      : "💳 New balance top-up";

  await notifyPaymentAdmins({
    title,
    lines: [
      `Amount: $${params.amount.toFixed(2)}`,
      `Provider: ${params.provider}`,
      `Status: ${params.status}`,
      `Ref: ${params.referenceCode}`,
      `User: ${who}`,
    ],
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: params.status === "MANUAL_REVIEW" ? "Review top-up" : "View top-up",
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
  const html = buildPremiumTelegramMessage({
    headline: "Balance credited",
    sections: [
      { label: "Amount", value: formatUsd(params.amount) },
      { label: "Customer", value: who },
      { label: "Provider", value: formatProviderLabel(params.provider) },
      { label: "Reference", value: params.referenceCode },
    ],
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: "View payment",
  });

  await sendTelegramToAdminList(html, "payment");

  const link = panelUrl(`/billing/top-ups/${params.topUpId}`);
  await sendDiscordToWebhooks(getDiscordWebhookUrls(), {
    content: `**Balance credited**\n${formatUsd(params.amount)} · ${who} · ${params.referenceCode}`.slice(
      0,
      2000,
    ),
    embeds: [{ title: "View payment", url: link, color: 0x22c55e }],
  });
}

export async function notifyAdminsReferralSignup(params: {
  userId: string;
  referrerId: string;
  referralCode: string;
}) {
  const [newUser, referrer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, telegramUsername: true, displayName: true },
    }),
    prisma.user.findUnique({
      where: { id: params.referrerId },
      select: {
        email: true,
        telegramUsername: true,
        displayName: true,
        referralCode: true,
        customReferralPercent: true,
        affiliateTier: { select: { name: true, percent: true } },
      },
    }),
  ]);

  if (!newUser || !referrer) return;

  const newUserLabel =
    newUser.email ??
    (newUser.telegramUsername ? `@${newUser.telegramUsername}` : newUser.displayName ?? params.userId.slice(0, 8));

  const referrerLabel =
    referrer.email ??
    (referrer.telegramUsername
      ? `@${referrer.telegramUsername}`
      : referrer.displayName ?? params.referrerId.slice(0, 8));

  const percent =
    Number(referrer.customReferralPercent) ||
    Number(referrer.affiliateTier?.percent) ||
    DEFAULT_REFERRAL_PERCENT;

  const tierLabel = referrer.affiliateTier?.name
    ? `${referrer.affiliateTier.name} · ${percent}%`
    : `${percent}%`;

  const html = buildPremiumTelegramMessage({
    headline: "New referral signup",
    sections: [
      { label: "New user", value: newUserLabel },
      { label: "Referred by", value: referrerLabel },
      { label: "Referral code", value: params.referralCode },
      { label: "Commission rate", value: tierLabel },
    ],
    link: `/users/${params.userId}`,
    linkLabel: "View customer",
  });

  await sendTelegramToAdminList(html, "all");

  const link = panelUrl(`/users/${params.userId}`);
  await sendDiscordToWebhooks(getDiscordWebhookUrls(), {
    content:
      `**New referral signup**\n` +
      `User: ${newUserLabel}\n` +
      `Referrer: ${referrerLabel}\n` +
      `Code: ${params.referralCode}\n` +
      `Rate: ${tierLabel}`.slice(0, 2000),
    embeds: [{ title: "View customer", url: link, color: 0x8b5cf6 }],
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

export async function notifyAdminsOperationalAlert(params: {
  category: string;
  message: string;
  severity?: "warning" | "error" | "critical";
  details?: Record<string, string | number | undefined>;
  serviceId?: string;
  userId?: string;
}): Promise<void> {
  const severity = params.severity ?? "error";
  const icon =
    severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "❗";
  const who = params.userId
    ? escapeTelegramHtml(await getUserLabel(params.userId))
    : undefined;
  const detailLines = params.details
    ? Object.entries(params.details)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${escapeTelegramHtml(k)}: ${escapeTelegramHtml(String(v))}`)
        .join("\n")
    : "";

  const link = params.serviceId ? panelUrl(`/services/${params.serviceId}`) : undefined;

  await notifyHostingAdmins(
    `${icon} <b>Billing alert</b>\n` +
      `<b>${escapeTelegramHtml(params.category)}</b>\n` +
      `${escapeTelegramHtml(params.message)}\n` +
      (who ? `User: ${who}\n` : "") +
      (detailLines ? `${detailLines}\n` : "") +
      (link ? `<a href="${link}">Open service</a>` : ""),
  );
}

export async function notifyAdminsProvisioningFailed(params: {
  serviceId: string;
  userId: string;
  label: string;
  error: string;
  hostname?: string;
}): Promise<void> {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const link = panelUrl(`/services/${params.serviceId}`);
  await notifyHostingAdmins(
    `🛑 <b>VPS provisioning failed</b>\n` +
      `<b>${escapeTelegramHtml(params.label)}</b>\n` +
      (params.hostname ? `Host: ${escapeTelegramHtml(params.hostname)}\n` : "") +
      `Error: ${escapeTelegramHtml(params.error.slice(0, 500))}\n` +
      `User: ${who}\n` +
      `<a href="${link}">Open service</a>`,
  );
}

export async function notifyAdminsNewService(params: {
  serviceId: string;
  userId: string;
  label: string;
  type: string;
  status: string;
  monthlyPrice: number;
}) {
  const who = escapeTelegramHtml(await getUserLabel(params.userId));
  const link = panelUrl(`/services/${params.serviceId}`);
  await notifyHostingAdmins(
    `🖥 <b>New service order</b>\n` +
      `<b>${escapeTelegramHtml(params.label)}</b>\n` +
      `Type: ${escapeTelegramHtml(params.type)}\n` +
      `Status: ${escapeTelegramHtml(params.status)}\n` +
      `Price: $${params.monthlyPrice.toFixed(2)}/mo\n` +
      `User: ${who}\n` +
      `<a href="${link}">Open service</a>`,
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
