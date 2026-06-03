import { prisma } from "@dior/database";
import type { Prisma, TransactionType } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { invalidateUserDashboardCache } from "../../users";
import { requirePermission } from "../rbac";
import { toIso, toMoney } from "./serialize";

export async function listAdminTransactions(
  actorId: string,
  options: {
    q?: string;
    type?: TransactionType;
    userId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "billing.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 30, 100);
  const q = options.q?.trim();

  const where: Prisma.TransactionWhereInput = {
    ...(options.type && { type: options.type }),
    ...(options.userId && { userId: options.userId }),
    ...(q && {
      OR: [
        { description: { contains: q } },
        { user: { email: { contains: q } } },
        ...(q.length > 8 ? [{ id: q }, { userId: q }] : []),
      ],
    }),
  };

  const [items, total, typeStats] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        invoice: { select: { id: true, number: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["type"],
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return {
    items: items.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: toMoney(tx.amount),
      balanceAfter: toMoney(tx.balanceAfter),
      description: tx.description,
      createdAt: toIso(tx.createdAt)!,
      user: {
        id: tx.user.id,
        email: tx.user.email,
        displayName: tx.user.displayName,
      },
      invoice: tx.invoice
        ? { id: tx.invoice.id, number: tx.invoice.number }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    typeStats: typeStats.map((s) => ({
      type: s.type,
      count: s._count,
      volume: toMoney(s._sum.amount),
    })),
  };
}

export async function adminRefundToBalance(
  actorId: string,
  userId: string,
  params: { amount: number; reason: string; invoiceId?: string },
) {
  await requirePermission(actorId, "billing.write");

  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("Refund amount must be greater than 0");
  }
  if (!params.reason.trim()) throw new Error("Reason is required");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");

  const after = toMoney(user.balance) + params.amount;

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: after },
    }),
    prisma.transaction.create({
      data: {
        userId,
        invoiceId: params.invoiceId,
        type: "REFUND",
        amount: params.amount,
        balanceAfter: after,
        description: `Admin refund: ${params.reason.trim()}`,
        metadata: { actorId, reason: params.reason.trim() },
      },
    }),
  ]);

  await createAuditLog({
    actorId,
    action: "billing.refund",
    entityType: "user",
    entityId: userId,
    metadata: { amount: params.amount, reason: params.reason, invoiceId: params.invoiceId },
  });

  await invalidateUserDashboardCache(userId);

  return { balance: toMoney(updated.balance) };
}
