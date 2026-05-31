import { prisma } from "@dior/database";
import { enqueueJob } from "../../lib/queue";
import { markSubscriptionPastDue } from "./subscriptions";

const GRACE_DAYS = 3;

/** Automatic service suspension after grace — set BILLING_AUTO_SUSPEND=true in production. */
export const AUTOMATIC_SERVICE_SUSPENSION =
  process.env.BILLING_AUTO_SUSPEND === "true";

/**
 * Job: mark overdue subscriptions (grace). Does not suspend services while AUTOMATIC_SERVICE_SUSPENSION is off.
 */
export async function runUnpaidServiceChecker(): Promise<{
  graceStarted: number;
  suspended: number;
}> {
  let graceStarted = 0;
  const suspended = 0;
  const now = new Date();

  const overdueItems = await prisma.invoiceItem.findMany({
    where: {
      serviceId: { not: null },
      invoice: { status: "OVERDUE" },
      service: { status: "ACTIVE" },
    },
    include: { service: true, invoice: true },
    take: 100,
  });

  for (const item of overdueItems) {
    if (!item.serviceId || !item.service) continue;

    const sub = await prisma.subscription.findUnique({
      where: { serviceId: item.serviceId },
    });

    if (!sub?.graceUntil) {
      const graceUntil = new Date();
      graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);
      await markSubscriptionPastDue(item.serviceId, graceUntil, `grace:${item.invoiceId}`);
      graceStarted++;
      continue;
    }

    if (
      AUTOMATIC_SERVICE_SUSPENSION &&
      sub.graceUntil <= now &&
      sub.status === "past_due"
    ) {
      const { transitionServiceLifecycle } = await import("../provisioning/engine");
      await transitionServiceLifecycle({
        serviceId: item.serviceId,
        to: "SUSPENDED",
        reason: "Grace period expired — unpaid invoice",
        idempotencyKey: `suspend:grace:${item.serviceId}:${item.invoiceId}`,
      });
    }
  }

  return { graceStarted, suspended };
}

export function scheduleUnpaidServiceChecker(): void {
  enqueueJob("billing.unpaid_check", {}).catch(() => {});
}
