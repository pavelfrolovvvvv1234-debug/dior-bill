import { prisma } from "@dior/database";
import type { TopUpStatus, TopUpProvider, Prisma } from "@dior/database";
import { approveManualTopUp, rejectManualTopUp, completeTopUp } from "../topup";
import { requirePermission } from "../../admin/rbac";

export async function listAdminTopUps(
  actorId: string,
  filters: {
    status?: TopUpStatus | TopUpStatus[];
    provider?: TopUpProvider;
    manualOnly?: boolean;
    page?: number;
    pageSize?: number;
    search?: string;
    userId?: string;
  },
) {
  await requirePermission(actorId, "payments.read");
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 30;

  const statusFilter = filters.status
    ? Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status
    : undefined;

  const where: Prisma.TopUpWhereInput = {
    ...(statusFilter && { status: statusFilter }),
    ...(filters.provider && { provider: filters.provider }),
    ...(filters.manualOnly && { provider: "MANUAL_TRANSFER" }),
    ...(filters.search && {
      OR: [
        { referenceCode: { contains: filters.search } },
        { externalId: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ],
    }),
    ...(filters.userId && { userId: filters.userId }),
  };

  const [items, total, stats] = await Promise.all([
    prisma.topUp.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, displayName: true, telegramUsername: true } },
        reviewedBy: { select: { id: true, displayName: true } },
      },
    }),
    prisma.topUp.count({ where }),
    prisma.topUp.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats,
  };
}

export async function adminApproveTopUp(
  actorId: string,
  topUpId: string,
  partialAmount?: number,
  notes?: string,
) {
  await requirePermission(actorId, "payments.write");
  return approveManualTopUp(topUpId, actorId, { partialAmount, notes });
}

export async function adminRejectTopUp(actorId: string, topUpId: string, reason: string) {
  await requirePermission(actorId, "payments.write");
  return rejectManualTopUp(topUpId, actorId, reason);
}

export async function adminForceComplete(actorId: string, topUpId: string, notes?: string) {
  await requirePermission(actorId, "payments.write");
  return completeTopUp(topUpId, { actorId, adminNotes: notes });
}
