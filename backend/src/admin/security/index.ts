import { prisma } from "@dior/database";
import { resolveManualReview } from "../../core/abuse/review-queue";
import { requirePermission } from "../rbac";

export async function getSecurityFeed(actorId: string) {
  await requirePermission(actorId, "security.read");

  const [reviews, abuseReports, recentLogins, failedTopUps] = await Promise.all([
    prisma.manualReviewQueue.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { id: true, email: true, status: true } } },
    }),
    prisma.abuseReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.loginHistory.findMany({
      where: { success: false },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } } },
    }),
    prisma.topUp.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
  ]);

  return { reviews, abuseReports, recentLogins, failedTopUps };
}

export async function adminResolveReview(
  actorId: string,
  reviewId: string,
  action: "approve" | "reject" | "freeze" | "escalate",
  resolution?: string,
) {
  await requirePermission(actorId, "security.write");
  return resolveManualReview({ reviewId, action, actorId, resolution });
}
