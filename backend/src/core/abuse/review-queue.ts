import { prisma } from "@dior/database";
import { appendDomainEvent } from "../events/store";
import { DOMAIN_EVENTS } from "@dior/shared";
import { setAbuseAction } from "./engine";
import { createAuditLog } from "../../audit";

export async function enqueueManualReview(params: {
  userId: string;
  reason: string;
  riskScore: number;
  metadata?: Record<string, unknown>;
}) {
  return prisma.manualReviewQueue.create({
    data: {
      userId: params.userId,
      reason: params.reason,
      riskScore: params.riskScore,
      status: "open",
    },
  });
}

export async function resolveManualReview(params: {
  reviewId: string;
  action: "approve" | "reject" | "freeze" | "escalate";
  actorId: string;
  resolution?: string;
}) {
  const review = await prisma.manualReviewQueue.findUniqueOrThrow({
    where: { id: params.reviewId },
  });

  const statusMap = {
    approve: "approved",
    reject: "rejected",
    freeze: "frozen",
    escalate: "escalated",
  } as const;

  const updated = await prisma.manualReviewQueue.update({
    where: { id: params.reviewId },
    data: {
      status: statusMap[params.action],
      reviewedById: params.actorId,
      reviewedAt: new Date(),
      resolution: params.resolution,
    },
  });

  await createAuditLog({
    actorId: params.actorId,
    action: `abuse.review.${params.action}`,
    entityType: "manual_review",
    entityId: params.reviewId,
    metadata: { userId: review.userId },
  });

  if (params.action === "freeze") {
    await setAbuseAction(review.userId, "freeze", params.actorId);
    await enqueueManualReview({
      userId: review.userId,
      reason: "Auto-freeze requires audit trail",
      riskScore: review.riskScore,
    });
  } else if (params.action === "approve") {
    await setAbuseAction(review.userId, "allow", params.actorId);
  }

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.ABUSE_CHALLENGE,
    aggregateType: "user",
    aggregateId: review.userId,
    userId: review.userId,
    payload: { action: params.action, reviewId: params.reviewId },
    idempotencyKey: `review:${params.reviewId}:${params.action}`,
  });

  return updated;
}

export async function listOpenReviews(limit = 50) {
  return prisma.manualReviewQueue.findMany({
    where: { status: { in: ["open", "escalated"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
}
