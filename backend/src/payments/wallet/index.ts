import { prisma, type Prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { toJsonValue } from "../../lib/json";
import { invalidateUserDashboardCache } from "../../users";

export interface WalletSnapshot {
  balance: number;
  locked: number;
  available: number;
  credits: number;
  /** Balance available for checkout (available + promo credits). */
  spendable: number;
}

export async function getWallet(userId: string): Promise<WalletSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, balanceLocked: true, credits: true },
  });
  if (!user) throw new NotFoundError("User not found");
  const balance = Number(user.balance);
  const locked = Number(user.balanceLocked);
  const available = balance - locked;
  const credits = Number(user.credits);
  return {
    balance,
    locked,
    available,
    credits,
    spendable: available + credits,
  };
}

export async function creditWallet(params: {
  userId: string;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  tx?: Prisma.TransactionClient;
}) {
  if (params.amount <= 0) throw new ValidationError("Amount must be positive");

  const run = async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new NotFoundError("User not found");

    const newBalance = Number(user.balance) + params.amount;
    await tx.user.update({
      where: { id: params.userId },
      data: { balance: newBalance },
    });

    const ledger = await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "CREDIT",
        amount: params.amount,
        balanceAfter: newBalance,
        description: params.description,
        metadata: toJsonValue(params.metadata),
      },
    });

    return { newBalance, ledgerId: ledger.id };
  };

  const result = params.tx ? await run(params.tx) : await prisma.$transaction(run);

  if (!params.tx) {
    await createAuditLog({
      actorId: params.actorId ?? params.userId,
      action: "wallet.credit",
      entityType: "transaction",
      entityId: result.ledgerId,
      metadata: { amount: params.amount, description: params.description },
    });
    await invalidateUserDashboardCache(params.userId);
  }

  return result;
}

export async function debitWallet(params: {
  userId: string;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  tx?: Prisma.TransactionClient;
}) {
  if (params.amount <= 0) throw new ValidationError("Amount must be positive");

  const run = async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new NotFoundError("User not found");

    const current = Number(user.balance);
    if (current < params.amount) {
      throw new ValidationError("Insufficient balance");
    }

    const newBalance = current - params.amount;
    await tx.user.update({
      where: { id: params.userId },
      data: { balance: newBalance },
    });

    const ledger = await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "ADJUSTMENT",
        amount: params.amount,
        balanceAfter: newBalance,
        description: params.description,
        metadata: toJsonValue(params.metadata),
      },
    });

    return { newBalance, ledgerId: ledger.id };
  };

  const result = params.tx ? await run(params.tx) : await prisma.$transaction(run);

  if (!params.tx) {
    await createAuditLog({
      actorId: params.actorId ?? params.userId,
      action: "wallet.debit",
      entityType: "transaction",
      entityId: result.ledgerId,
      metadata: { amount: params.amount, description: params.description },
    });
    await invalidateUserDashboardCache(params.userId);
  }

  return result;
}

export async function lockBalance(userId: string, amount: number, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError();
  const available = Number(user.balance) - Number(user.balanceLocked);
  if (amount > available) throw new ValidationError("Insufficient available balance");
  await db.user.update({
    where: { id: userId },
    data: { balanceLocked: { increment: amount } },
  });
}

export async function unlockBalance(userId: string, amount: number, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  await db.user.update({
    where: { id: userId },
    data: { balanceLocked: { decrement: amount } },
  });
}
