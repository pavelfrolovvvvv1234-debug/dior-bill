import { prisma, type Prisma } from "@dior/database";

let referralQualifiesColumn: boolean | undefined;

/** Detect whether DB migration for referral_qualifies has been applied. */
export async function hasReferralQualifiesColumn(): Promise<boolean> {
  if (referralQualifiesColumn !== undefined) return referralQualifiesColumn;
  try {
    const rows = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'referral_qualifies'
    `;
    referralQualifiesColumn = Number(rows[0]?.cnt ?? 0) > 0;
  } catch {
    referralQualifiesColumn = false;
  }
  return referralQualifiesColumn;
}

/** True only when referrer was attached at account creation (new signup). */
export function isEligibleReferral(
  user: {
    referredById?: string | null;
    referralQualifies?: boolean;
  },
  columnActive = true,
): boolean {
  if (!user.referredById) return false;
  if (!columnActive) return false;
  return user.referralQualifies === true;
}

/** Prisma filter for referred users that count toward a referrer. */
export async function eligibleReferralWhere(referrerId?: string): Promise<Prisma.UserWhereInput> {
  const base: Prisma.UserWhereInput = referrerId
    ? { referredById: referrerId }
    : { referredById: { not: null } };

  if (await hasReferralQualifiesColumn()) {
    return { ...base, referralQualifies: true };
  }

  // Migration pending — no qualified referrals yet (avoids counting legacy dump users).
  return { ...base, id: { in: [] } };
}

export async function countEligibleReferralsByReferrer(
  referrerIds: string[],
): Promise<Record<string, number>> {
  if (referrerIds.length === 0) return {};
  if (!(await hasReferralQualifiesColumn())) return {};

  try {
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
  } catch {
    return {};
  }
}
