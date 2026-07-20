import type { Prisma } from "@dior/database";
import { MANUAL_SUPPORT_TELEGRAM } from "@dior/shared";

const DEFAULT_EXCLUDED = [
  MANUAL_SUPPORT_TELEGRAM.replace(/^@/, "").toLowerCase(),
];

/** Telegram usernames whose top-ups must not affect admin stats or referral commissions. */
export function getStatsExcludedTelegramUsernames(): string[] {
  const raw = process.env.STATS_EXCLUDED_TELEGRAM_USERNAMES?.trim();
  if (raw) {
    const parsed = raw
      .split(",")
      .map((part) => part.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);
    if (parsed.length > 0) return [...new Set(parsed)];
  }
  return [...DEFAULT_EXCLUDED];
}

function statsExcludedTelegramUserWhere(): Prisma.UserWhereInput | undefined {
  const names = getStatsExcludedTelegramUsernames();
  if (names.length === 0) return undefined;
  return {
    OR: names.map((name) => ({
      telegramUsername: { equals: name, mode: "insensitive" as const },
    })),
  };
}

/** Exclude internal/test accounts from top-up aggregates in admin analytics. */
export function topUpStatsUserFilter(): Prisma.TopUpWhereInput {
  const excluded = statsExcludedTelegramUserWhere();
  if (!excluded) return {};
  return { user: { NOT: excluded } };
}

/** Exclude commissions earned from internal account payments. */
export function referralStatsSourceUserFilter(): Prisma.ReferralEarningWhereInput {
  const excluded = statsExcludedTelegramUserWhere();
  if (!excluded) return {};
  return { sourceUser: { NOT: excluded } };
}

export function isStatsExcludedTelegramUsername(username: string | null | undefined): boolean {
  if (!username?.trim()) return false;
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  return getStatsExcludedTelegramUsernames().includes(normalized);
}
