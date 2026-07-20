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

/**
 * MySQL-safe user filter: never use Prisma `mode: "insensitive"` (Postgres-only —
 * it crashes /control on MySQL). utf8mb4_*_ci collations already match case-insensitively.
 * Explicitly keep users with null telegramUsername (SQL NOT + NULL would drop them).
 */
function statsExcludedUserFilter(): Prisma.UserWhereInput | undefined {
  const names = getStatsExcludedTelegramUsernames();
  if (names.length === 0) return undefined;
  return {
    OR: [{ telegramUsername: null }, { telegramUsername: { notIn: names } }],
  };
}

/** Exclude internal/test accounts from top-up aggregates in admin analytics. */
export function topUpStatsUserFilter(): Prisma.TopUpWhereInput {
  const user = statsExcludedUserFilter();
  if (!user) return {};
  return { user };
}

/** Exclude commissions earned from internal account payments. */
export function referralStatsSourceUserFilter(): Prisma.ReferralEarningWhereInput {
  const user = statsExcludedUserFilter();
  if (!user) return {};
  return { sourceUser: user };
}

export function isStatsExcludedTelegramUsername(username: string | null | undefined): boolean {
  if (!username?.trim()) return false;
  const normalized = username.trim().replace(/^@/, "").toLowerCase();
  return getStatsExcludedTelegramUsernames().includes(normalized);
}
