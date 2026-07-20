import { prisma } from "@dior/database";
import { ADMIN_ROLES, DEFAULT_REFERRAL_PERCENT } from "@dior/shared";
import { escapeTelegramHtml, sendTelegramMessage } from "./bot";

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

function billingSiteLabel(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    "Website";
  try {
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return "Website";
  }
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

function shortUserTag(userId: string): string {
  return `#${userId.slice(-4)}`;
}

/** Compact premium SaaS alert — 2–3 lines, no walls of text. */
function buildCompactAlert(params: {
  title: string;
  meta: string[];
  ref?: string;
  link?: string;
  linkLabel?: string;
}): string {
  const site = escapeTelegramHtml(billingSiteLabel());
  const line1 = `<b>${escapeTelegramHtml(params.title)}</b>  <i>${site}</i>`;

  const meta = params.meta
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => escapeTelegramHtml(m))
    .join(" · ");

  const ref = params.ref?.trim();
  const link = params.link ? panelUrl(params.link) : undefined;
  const linkLabel = escapeTelegramHtml(params.linkLabel ?? "Open");

  let line3 = "";
  if (ref && link) {
    line3 = `<code>${escapeTelegramHtml(ref)}</code> · <a href="${link}">${linkLabel}</a>`;
  } else if (ref) {
    line3 = `<code>${escapeTelegramHtml(ref)}</code>`;
  } else if (link) {
    line3 = `<a href="${link}">${linkLabel}</a>`;
  }

  return [line1, meta, line3].filter(Boolean).join("\n");
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

function getConfiguredAdminChatIds(): string[] {
  return parseIdList(
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
  );
}

function getConfiguredAdminUserIds(): string[] {
  return parseIdList(process.env.TELEGRAM_ADMIN_USER_IDS);
}

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
    .map((u: { telegramId: bigint | null }) => u.telegramId?.toString())
    .filter((id: string | undefined): id is string => Boolean(id));
}

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
    .map((a: { telegramId: bigint | null }) => a.telegramId?.toString())
    .filter((id: string | undefined): id is string => Boolean(id));
}

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
      .filter(
        (a: { id: string; telegramId: bigint | null }) =>
          a.telegramId && explicitChatIds.has(a.telegramId.toString()),
      )
      .map((a: { id: string }) => a.id);
    if (matched.length > 0) return matched;
  }

  if (process.env.TELEGRAM_ADMIN_NOTIFY_FALLBACK === "false") {
    return [];
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] } },
    select: { id: true },
  });
  return admins.map((a: { id: string }) => a.id);
}

async function getUserLabel(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, telegramUsername: true, displayName: true },
  });
  if (!user) return shortUserTag(userId);
  if (user.telegramUsername) return `@${user.telegramUsername}`;
  if (user.email) return user.email;
  if (user.displayName) return user.displayName;
  return shortUserTag(userId);
}

async function getReferralShort(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referredById: true,
      referredBy: { select: { telegramUsername: true, email: true, referralCode: true } },
    },
  });
  if (!user?.referredById || !user.referredBy) return null;
  const ref = user.referredBy;
  if (ref.telegramUsername) return `via @${ref.telegramUsername}`;
  if (ref.referralCode) return `via ${ref.referralCode}`;
  return null;
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

async function notifyCompact(params: {
  title: string;
  meta: string[];
  ref?: string;
  link?: string;
  linkLabel?: string;
  scope?: "all" | "payment";
  discordColor?: number;
}): Promise<void> {
  const scope = params.scope ?? "all";
  const html = buildCompactAlert(params);
  await sendTelegramToAdminList(html, scope);

  const link = params.link ? panelUrl(params.link) : undefined;
  const discordLines = [
    `**${params.title}** · ${billingSiteLabel()}`,
    params.meta.filter(Boolean).join(" · "),
    params.ref ? `\`${params.ref}\`` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendDiscordToWebhooks(getDiscordWebhookUrls(), {
    content: discordLines.slice(0, 2000),
    embeds: link
      ? [{ title: params.linkLabel ?? "Open", url: link, color: params.discordColor ?? 0x3b82f6 }]
      : undefined,
  });
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
  await notifyCompact({
    title: params.title,
    meta: params.lines,
    link: params.link,
    linkLabel: params.linkLabel,
    scope: "payment",
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
  const manual = params.status === "MANUAL_REVIEW";

  await notifyCompact({
    title: formatUsd(params.amount),
    meta: [
      who,
      manual ? "bank transfer" : formatProviderLabel(params.provider),
      manual ? "review" : "pending",
    ],
    ref: params.referenceCode,
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: manual ? "Review" : "Open",
    scope: "payment",
    discordColor: manual ? 0xf59e0b : 0x6366f1,
  });
}

export async function notifyAdminsTopUpPaid(params: {
  topUpId: string;
  userId: string;
  amount: number;
  provider: string;
  referenceCode: string;
}) {
  const [who, via] = await Promise.all([
    getUserLabel(params.userId),
    getReferralShort(params.userId),
  ]);

  await notifyCompact({
    title: `+${formatUsd(params.amount)}`,
    meta: [who, formatProviderLabel(params.provider), via].filter((x): x is string => Boolean(x)),
    ref: params.referenceCode,
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: "Open",
    scope: "payment",
    discordColor: 0x22c55e,
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
        customReferralPercent: true,
        affiliateTier: { select: { percent: true } },
      },
    }),
  ]);

  if (!newUser || !referrer) return;

  const newUserLabel =
    (newUser.telegramUsername ? `@${newUser.telegramUsername}` : null) ??
    newUser.email ??
    newUser.displayName ??
    shortUserTag(params.userId);

  const referrerLabel =
    (referrer.telegramUsername ? `@${referrer.telegramUsername}` : null) ??
    referrer.email ??
    referrer.displayName ??
    shortUserTag(params.referrerId);

  const percent =
    Number(referrer.customReferralPercent) ||
    Number(referrer.affiliateTier?.percent) ||
    DEFAULT_REFERRAL_PERCENT;

  await notifyCompact({
    title: "Referral signup",
    meta: [newUserLabel, `via ${referrerLabel}`, `${percent}%`],
    ref: params.referralCode,
    link: `/users/${params.userId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0x8b5cf6,
  });
}

export async function notifyAdminsManualTopUpPending(params: {
  topUpId: string;
  userId: string;
  amount: number;
  referenceCode: string;
}) {
  const who = await getUserLabel(params.userId);

  await notifyCompact({
    title: formatUsd(params.amount),
    meta: [who, "bank transfer", "review"],
    ref: params.referenceCode,
    link: `/billing/top-ups/${params.topUpId}`,
    linkLabel: "Review",
    scope: "payment",
    discordColor: 0xf59e0b,
  });
}

export async function notifyAdminsBillingAlert(params: {
  headline: string;
  message: string;
  severity?: "warning" | "error" | "critical";
  details?: Record<string, string | number | undefined>;
  serviceId?: string;
  userId?: string;
}): Promise<void> {
  const severity = params.severity ?? "error";
  const prefix =
    severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Alert";

  const meta = [params.message.slice(0, 120)];
  if (params.userId) meta.unshift(await getUserLabel(params.userId));

  await notifyCompact({
    title: `${prefix} · ${params.headline}`,
    meta,
    link: params.serviceId ? `/services/${params.serviceId}` : undefined,
    linkLabel: "Open",
    scope: "all",
    discordColor: severity === "critical" ? 0xef4444 : severity === "warning" ? 0xf59e0b : 0xf97316,
  });
}

/** @deprecated alias — use notifyAdminsBillingAlert */
export async function notifyAdminsOperationalAlert(params: {
  category: string;
  message: string;
  severity?: "warning" | "error" | "critical";
  details?: Record<string, string | number | undefined>;
  serviceId?: string;
  userId?: string;
}): Promise<void> {
  await notifyAdminsBillingAlert({
    headline: params.category,
    message: params.message,
    severity: params.severity,
    details: params.details,
    serviceId: params.serviceId,
    userId: params.userId,
  });
}

export async function notifyAdminsProvisioningStuck(params: {
  serviceId: string;
  userId: string;
  label: string;
  message: string;
}): Promise<void> {
  const who = await getUserLabel(params.userId);
  await notifyCompact({
    title: "VPS stuck",
    meta: [params.label, who, params.message.slice(0, 80)],
    link: `/services/${params.serviceId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0xf59e0b,
  });
}

export async function notifyAdminsQueueJobDead(params: {
  jobType: string;
  jobId: string;
  error: string;
  serviceId?: string;
}): Promise<void> {
  await notifyCompact({
    title: "Job failed",
    meta: [params.jobType, params.error.slice(0, 100)],
    ref: params.jobId || undefined,
    link: params.serviceId ? `/services/${params.serviceId}` : undefined,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0xef4444,
  });
}

export async function notifyAdminsWorkerError(params: { message: string }): Promise<void> {
  await notifyCompact({
    title: "Worker error",
    meta: [params.message.slice(0, 140)],
    link: "/logs",
    linkLabel: "Logs",
    scope: "all",
    discordColor: 0xef4444,
  });
}

export async function notifyAdminsProvisioningFailed(params: {
  serviceId: string;
  userId: string;
  label: string;
  error: string;
  hostname?: string;
}): Promise<void> {
  const who = await getUserLabel(params.userId);
  await notifyCompact({
    title: "Provision failed",
    meta: [params.hostname ?? params.label, who, params.error.slice(0, 100)],
    link: `/services/${params.serviceId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0xef4444,
  });
}

export async function notifyAdminsNewService(params: {
  serviceId: string;
  userId: string;
  label: string;
  type: string;
  status: string;
  monthlyPrice: number;
}) {
  const who = await getUserLabel(params.userId);
  await notifyCompact({
    title: "New order",
    meta: [params.label, params.type, `${formatUsd(params.monthlyPrice)}/mo`, who],
    link: `/services/${params.serviceId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0x3b82f6,
  });
}

export async function notifyAdminsNewTicket(params: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const who = await getUserLabel(params.userId);
  await notifyCompact({
    title: "Ticket",
    meta: [params.subject.slice(0, 60), who],
    link: `/support/${params.ticketId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0x6366f1,
  });
}

export async function notifyAdminsTicketReply(params: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const who = await getUserLabel(params.userId);
  await notifyCompact({
    title: "Reply",
    meta: [params.subject.slice(0, 60), who],
    link: `/support/${params.ticketId}`,
    linkLabel: "Open",
    scope: "all",
    discordColor: 0x6366f1,
  });
}
