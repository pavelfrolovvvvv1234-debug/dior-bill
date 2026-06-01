import { prisma } from "@dior/database";
import { enqueueJob } from "../lib/queue";
import { processExpiredTopUps, syncPendingTopUps } from "../payments/topup";
import { processOverdueInvoices } from "./index";

const RENEWAL_BATCH = 50;

/**
 * Hourly billing maintenance: expire stale top-ups, mark overdue invoices,
 * queue service renewals and unpaid-service checks.
 */
export async function runBillingScheduler() {
  const expiredTopUps = await processExpiredTopUps();
  const syncedTopUps = await syncPendingTopUps();
  const overdueCount = await processOverdueInvoices();

  const dueServices = await prisma.service.findMany({
    where: {
      autoRenew: true,
      status: "ACTIVE",
      renewsAt: { lte: new Date() },
    },
    select: { id: true },
    take: RENEWAL_BATCH,
  });

  for (const service of dueServices) {
    await enqueueJob("service.renew", { serviceId: service.id });
  }

  await enqueueJob("billing.unpaid_check", {});

  return {
    expiredTopUps,
    syncedTopUps,
    overdueInvoices: overdueCount,
    renewalsQueued: dueServices.length,
  };
}
