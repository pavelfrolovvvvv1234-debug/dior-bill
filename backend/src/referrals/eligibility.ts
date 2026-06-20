import { prisma, type Prisma } from "@dior/database";

/** Users registered before this date never count as referrals (legacy / migrated accounts). */
const DEFAULT_REFERRAL_ELIGIBLE_SINCE = "2025-06-01T00:00:00.000Z";

export function getReferralEligibleSince(): Date {
  const raw = process.env.REFERRAL_ELIGIBLE_SINCE?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(DEFAULT_REFERRAL_ELIGIBLE_SINCE);
}

export function isEligibleReferral(user: {
  referredById?: string | null;
  createdAt: Date;
}): boolean {
  if (!user.referredById) return false;
  return user.createdAt >= getReferralEligibleSince();
}

/** Prisma filter for referred users that count toward a referrer. */
export function eligibleReferralWhere(referrerId?: string): Prisma.UserWhereInput {
  const since = getReferralEligibleSince();
  return {
    ...(referrerId ? { referredById: referrerId } : { referredById: { not: null } }),
    createdAt: { gte: since },
  };
}

export async function countEligibleReferralsByReferrer(
  referrerIds: string[],
): Promise<Record<string, number>> {
  if (referrerIds.length === 0) return {};

  const rows = await prisma.user.groupBy({
    by: ["referredById"],
    where: {
      referredById: { in: referrerIds },
      createdAt: { gte: getReferralEligibleSince() },
    },
    _count: { _all: true },
  });

  const map: Record<string, number> = {};
  for (const row of rows) {
    if (row.referredById) map[row.referredById] = row._count._all;
  }
  return map;
}
