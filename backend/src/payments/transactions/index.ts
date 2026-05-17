import { prisma, type TopUpStatus, type TopUpProvider } from "@dior/database";

export interface LedgerEntry {
  id: string;
  kind: "topup" | "ledger";
  provider?: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  referenceCode?: string;
  description: string;
  createdAt: Date;
  completedAt?: Date | null;
}

function mapTopUpToLedger(t: {
  id: string;
  provider: TopUpProvider;
  amount: unknown;
  fee: unknown;
  netAmount: unknown;
  status: TopUpStatus;
  referenceCode: string;
  createdAt: Date;
  paidAt: Date | null;
}): LedgerEntry {
  return {
    id: t.id,
    kind: "topup",
    provider: t.provider,
    amount: Number(t.amount),
    fee: Number(t.fee),
    netAmount: Number(t.netAmount),
    status: t.status,
    referenceCode: t.referenceCode,
    description: `Top-up via ${t.provider}`,
    createdAt: t.createdAt,
    completedAt: t.paidAt,
  };
}

function mapTxToLedger(tx: {
  id: string;
  type: string;
  amount: unknown;
  description: string;
  createdAt: Date;
}): LedgerEntry {
  return {
    id: tx.id,
    kind: "ledger",
    amount: Number(tx.amount),
    fee: 0,
    netAmount: Number(tx.amount),
    status: tx.type,
    description: tx.description,
    createdAt: tx.createdAt,
    completedAt: tx.createdAt,
  };
}

export async function getUserLedger(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: TopUpStatus;
    provider?: TopUpProvider;
    search?: string;
  },
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const topUpWhere = {
    userId,
    ...(options?.status && { status: options.status }),
    ...(options?.provider && { provider: options.provider }),
    ...(options?.search && {
      OR: [
        { referenceCode: { contains: options.search } },
        { externalId: { contains: options.search } },
      ],
    }),
  };

  if (options?.search) {
    const [topUps, transactions, topUpCount, txCount] = await Promise.all([
      prisma.topUp.findMany({
        where: topUpWhere,
        orderBy: { createdAt: "desc" },
        take: pageSize * 2,
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          description: { contains: options.search },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize * 2,
      }),
      prisma.topUp.count({ where: topUpWhere }),
      prisma.transaction.count({
        where: { userId, description: { contains: options.search } },
      }),
    ]);

    const entries = [
      ...topUps.map(mapTopUpToLedger),
      ...transactions.map(mapTxToLedger),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * pageSize;
    const items = entries.slice(start, start + pageSize);
    const total = topUpCount + txCount;
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  const mergeLimit = page * pageSize;
  const [topUps, transactions] = await Promise.all([
    prisma.topUp.findMany({
      where: topUpWhere,
      orderBy: { createdAt: "desc" },
      take: mergeLimit,
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: mergeLimit,
    }),
  ]);

  const entries = [
    ...topUps.map(mapTopUpToLedger),
    ...transactions.map(mapTxToLedger),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const start = (page - 1) * pageSize;
  const items = entries.slice(start, start + pageSize);

  const needsTotal = page > 1 || items.length >= pageSize;
  let total = items.length;
  if (needsTotal) {
    const [topUpCount, txCount] = await Promise.all([
      prisma.topUp.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId } }),
    ]);
    total = topUpCount + txCount;
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
