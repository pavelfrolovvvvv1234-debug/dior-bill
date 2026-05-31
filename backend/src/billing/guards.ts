import { prisma } from "@dior/database";
import { ForbiddenError, ValidationError } from "@dior/shared";

/** Block billing actions for frozen users or suspended accounts. */
export async function assertBillingAllowed(userId: string) {
  const [user, risk] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    prisma.userRiskProfile.findUnique({ where: { userId } }),
  ]);

  if (!user || user.status !== "ACTIVE") {
    throw new ForbiddenError("Account is not active");
  }

  if (risk?.frozenAt || risk?.abuseAction === "freeze") {
    throw new ForbiddenError("Billing is frozen on this account");
  }
}

export async function assertTopUpAmountMatches(
  topUpId: string,
  receivedAmount: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp) return { ok: false, reason: "Top-up not found" };

  const expected = Number(topUp.netAmount);
  const tolerance = Math.max(0.01, expected * 0.001);

  if (Math.abs(receivedAmount - expected) <= tolerance) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `Amount mismatch: expected $${expected.toFixed(2)}, received $${receivedAmount.toFixed(2)}`,
  };
}
