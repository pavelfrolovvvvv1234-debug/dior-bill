import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { syncTopUpStatus } from "../../payments/topup";
import { requirePermission } from "../rbac";
import { toIso, toMoney } from "./serialize";

export async function getAdminTopUpDetail(actorId: string, topUpId: string) {
  await requirePermission(actorId, "payments.read");

  const topUp = await prisma.topUp.findUnique({
    where: { id: topUpId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          telegramUsername: true,
          balance: true,
        },
      },
      reviewedBy: { select: { id: true, email: true, displayName: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!topUp) throw new NotFoundError("Top-up not found");

  return {
    id: topUp.id,
    referenceCode: topUp.referenceCode,
    externalId: topUp.externalId,
    provider: topUp.provider,
    status: topUp.status,
    amount: toMoney(topUp.amount),
    fee: toMoney(topUp.fee),
    netAmount: toMoney(topUp.netAmount),
    currency: topUp.currency,
    paymentUrl: topUp.paymentUrl,
    expiresAt: toIso(topUp.expiresAt),
    paidAt: toIso(topUp.paidAt),
    failureReason: topUp.failureReason,
    adminNotes: topUp.adminNotes,
    metadata: topUp.metadata,
    createdAt: toIso(topUp.createdAt)!,
    updatedAt: toIso(topUp.updatedAt)!,
    reviewedAt: toIso(topUp.reviewedAt),
    user: {
      id: topUp.user.id,
      email: topUp.user.email,
      displayName: topUp.user.displayName,
      telegramUsername: topUp.user.telegramUsername,
      balance: toMoney(topUp.user.balance),
    },
    reviewedBy: topUp.reviewedBy
      ? {
          id: topUp.reviewedBy.id,
          email: topUp.reviewedBy.email,
          displayName: topUp.reviewedBy.displayName,
        }
      : null,
    events: topUp.events.map((e) => ({
      id: e.id,
      event: e.event,
      payload: e.payload,
      createdAt: toIso(e.createdAt)!,
    })),
  };
}

export async function adminSyncTopUp(actorId: string, topUpId: string) {
  await requirePermission(actorId, "payments.write");
  await syncTopUpStatus(topUpId);
  return getAdminTopUpDetail(actorId, topUpId);
}
