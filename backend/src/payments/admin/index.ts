import { prisma } from "@dior/database";
import type { TopUpStatus, TopUpProvider, Prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import {
  approveManualTopUp,
  rejectManualTopUp,
  completeTopUp,
  failTopUp,
  expireTopUp,
} from "../topup";
import { createAuditLog } from "../../audit";
import { toJsonValue } from "../../lib/json";
import { requirePermission } from "../../admin/rbac";

const ALL_TOPUP_STATUSES: TopUpStatus[] = [
  "PENDING",
  "PROCESSING",
  "MANUAL_REVIEW",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
];

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

/** Admin manual status override with correct billing side-effects. */
export async function adminSetTopUpStatus(
  actorId: string,
  topUpId: string,
  status: TopUpStatus,
  options?: { reason?: string; notes?: string },
) {
  await requirePermission(actorId, "payments.write");

  if (!ALL_TOPUP_STATUSES.includes(status)) {
    throw new ValidationError("Invalid top-up status");
  }

  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp) throw new NotFoundError("Top-up not found");
  if (topUp.status === status) return topUp;

  if (topUp.status === "PAID" && status !== "PAID" && status !== "REFUNDED") {
    throw new ValidationError(
      "Paid top-ups cannot be changed to another status. Refund the customer first.",
    );
  }

  await createAuditLog({
    actorId,
    action: "topup.status.override",
    entityType: "top_up",
    entityId: topUpId,
    metadata: { from: topUp.status, to: status, reason: options?.reason },
  });

  let result;

  switch (status) {
    case "PAID":
      result = await completeTopUp(topUpId, { actorId, adminNotes: options?.notes });
      break;
    case "FAILED":
      result = await failTopUp(topUpId, options?.reason ?? "Marked failed by admin");
      if (options?.notes) {
        result = await prisma.topUp.update({
          where: { id: topUpId },
          data: {
            adminNotes: options.notes,
            reviewedById: actorId,
            reviewedAt: new Date(),
          },
        });
      }
      break;
    case "EXPIRED":
      result = await expireTopUp(topUpId);
      break;
    default:
      result = await prisma.topUp.update({
        where: { id: topUpId },
        data: {
          status,
          failureReason: status === "MANUAL_REVIEW" ? null : topUp.failureReason,
          reviewedById: actorId,
          reviewedAt: new Date(),
          adminNotes: options?.notes ?? topUp.adminNotes,
        },
      });
      await prisma.topUpEvent.create({
        data: {
          topUpId,
          event: "admin_status_change",
          payload: toJsonValue({ from: topUp.status, to: status, actorId }),
        },
      });
      break;
  }

  return result;
}
