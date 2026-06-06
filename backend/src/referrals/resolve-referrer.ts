import { prisma } from "@dior/database";
import { normalizeReferralCode } from "@dior/shared";

export type ReferrerResolution = {
  normalizedCode?: string;
  referredById?: string;
  attributed: boolean;
};

export async function resolveReferrerId(
  referralCode: string | undefined | null,
): Promise<ReferrerResolution> {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) return { attributed: false };

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalizedCode },
    select: { id: true, status: true },
  });

  if (!referrer || referrer.status !== "ACTIVE") {
    return { normalizedCode, attributed: false };
  }

  return {
    normalizedCode,
    referredById: referrer.id,
    attributed: true,
  };
}
