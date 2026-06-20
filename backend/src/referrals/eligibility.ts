import { prisma, type Prisma } from "@dior/database";

/** True only when referrer was attached at account creation (new signup). */
export function isEligibleReferral(user: {
  referredById?: string | null;
  referralQualifies?: boolean;
}): boolean {
  return !!user.referredById && user.referralQualifies === true;
}

/** Prisma filter for referred users that count toward a referrer. */
export function eligibleReferralWhere(referrerId?: string): Prisma.UserWhereInput {
  return {
    ...(referrerId ? { referredById: referrerId } : { referredById: { not: null } }),
    referralQualifies: true,
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
      referralQualifies: true,
    },
    _count: { _all: true },
  });

  const map: Record<string, number> = {};
  for (const row of rows) {
    if (row.referredById) map[row.referredById] = row._count._all;
  }
  return map;
}
