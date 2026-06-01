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

  const expectedGross = Number(topUp.amount);
  const expectedNet = Number(topUp.netAmount);
  const tolerance = Math.max(0.05, expectedNet * 0.05);

  if (Math.abs(receivedAmount - expectedNet) <= tolerance) {
    return { ok: true };
  }
  if (Math.abs(receivedAmount - expectedGross) <= tolerance) {
    return { ok: true };
  }
  // Paid slightly under invoice (network fees) but within 5%
  if (receivedAmount >= expectedNet * 0.95 && receivedAmount <= expectedGross * 1.02) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `Amount mismatch: expected $${expectedNet.toFixed(2)}, received $${receivedAmount.toFixed(2)}`,
  };
}
