import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { invalidateUserDashboardCache } from "../../users";
import { requirePermission } from "../rbac";
import { toMoney } from "./serialize";

export async function adminSetBalanceLock(
  actorId: string,
  userId: string,
  params: { lockedAmount: number; reason: string },
) {
  await requirePermission(actorId, "billing.write");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  const balance = toMoney(user.balance);
  const locked = Math.max(0, params.lockedAmount);
  if (locked > balance) {
    throw new Error("Locked amount cannot exceed available balance");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { balanceLocked: locked },
  });

  await createAuditLog({
    actorId,
    action: "wallet.balance.lock",
    entityType: "user",
    entityId: userId,
    metadata: { locked, reason: params.reason, balance },
  });

  await invalidateUserDashboardCache(userId);

  return {
    balance: toMoney(updated.balance),
    balanceLocked: toMoney(updated.balanceLocked),
    available: toMoney(updated.balance) - toMoney(updated.balanceLocked),
  };
}

export async function adminGrantCredits(
  actorId: string,
  userId: string,
  params: { amount: number; reason: string },
) {
  await requirePermission(actorId, "billing.write");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("Credit amount must be greater than 0");
  }

  const afterCredits = toMoney(user.credits) + params.amount;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { credits: afterCredits },
  });

  await createAuditLog({
    actorId,
    action: "wallet.credits.grant",
    entityType: "user",
    entityId: userId,
    metadata: { amount: params.amount, reason: params.reason, after: afterCredits },
  });

  await invalidateUserDashboardCache(userId);

  return { credits: toMoney(updated.credits) };
}
