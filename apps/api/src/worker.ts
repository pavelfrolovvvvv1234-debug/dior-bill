import {
  dequeueJob,
  completeJob,
  failJob,
  processExpiredTopUps,
  syncTopUpStatus,
  runVpsProvisionPipeline,
  syncVpsBandwidth,
  rebootVpsOnProxmox,
  reinstallVpsOnProxmox,
  processEventById,
  runReconciliation,
  runAllReconciliations,
  runUnpaidServiceChecker,
  runBillingScheduler,
  handleInvoiceOverdue,
  renewService,
} from "@dior/backend";
import { prisma } from "@dior/database";
import { createNotification, deliverTelegramNotification } from "@dior/backend";

async function processVpsProvision(payload: {
  serviceId: string;
  vpsId: string;
  jobId: string;
  idempotencyKey?: string;
}) {
  await runVpsProvisionPipeline(payload);

  const vps = await prisma.vpsInstance.findUnique({
    where: { id: payload.vpsId },
    select: { primaryIp: true },
  });
  const service = await prisma.service.findUnique({
    where: { id: payload.serviceId },
    select: { userId: true, label: true },
  });
  if (service && vps?.primaryIp) {
    await createNotification({
      userId: service.userId,
      type: "deployment",
      title: "VPS deployed",
      body: `${service.label} is now active at ${vps.primaryIp}`,
      link: `/vps/${payload.vpsId}`,
    });
  }
}

let lastReconciliation = 0;
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000;

let lastBillingScheduler = 0;
const BILLING_SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;

async function run() {
  console.log("Dior worker started (event-driven control plane)");
  runBillingScheduler().catch((e) => console.error("Initial billing scheduler:", e));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (Date.now() - lastReconciliation > RECONCILE_INTERVAL_MS) {
        lastReconciliation = Date.now();
        runAllReconciliations().catch((e) =>
          console.error("Reconciliation error:", e),
        );
      }

      if (Date.now() - lastBillingScheduler > BILLING_SCHEDULER_INTERVAL_MS) {
        lastBillingScheduler = Date.now();
        runBillingScheduler().catch((e) =>
          console.error("Billing scheduler error:", e),
        );
      }

      const job = await dequeueJob();
      if (!job) continue;

      try {
        switch (job.type) {
          case "vps.provision":
            await processVpsProvision(
              job.payload as Parameters<typeof processVpsProvision>[0],
            );
            break;
          case "vps.reboot": {
            const { vpsId } = job.payload as { vpsId: string };
            await rebootVpsOnProxmox(vpsId);
            break;
          }
          case "vps.reinstall": {
            const payload = job.payload as { vpsId: string; os?: string; userId?: string };
            const vps = await prisma.vpsInstance.findUnique({
              where: { id: payload.vpsId },
              select: { service: { select: { userId: true } } },
            });
            if (vps) {
              await reinstallVpsOnProxmox(
                payload.vpsId,
                payload.userId ?? vps.service.userId,
                payload.os,
              );
            }
            break;
          }
          case "vps.sync_metrics": {
            const { vpsId } = job.payload as { vpsId: string };
            await syncVpsBandwidth(vpsId);
            break;
          }
          case "event.process": {
            const { eventId } = job.payload as { eventId: string };
            await processEventById(eventId);
            break;
          }
          case "reconciliation.run": {
            const { domain } = job.payload as { domain?: Parameters<typeof runReconciliation>[0] };
            if (domain) await runReconciliation(domain);
            else await runAllReconciliations();
            break;
          }
          case "notification.send": {
            const payload = job.payload as {
              notificationId: string;
              userId: string;
              channel?: string;
            };
            if (payload.channel === "telegram" || !payload.channel) {
              await deliverTelegramNotification(payload.notificationId, payload.userId);
            } else {
              await prisma.notificationDelivery.updateMany({
                where: { notificationId: payload.notificationId, channel: payload.channel },
                data: { status: "sent", sentAt: new Date() },
              });
            }
            break;
          }
          case "payment.retry": {
            const payload = job.payload as { topUpId?: string };
            if (payload.topUpId) await syncTopUpStatus(payload.topUpId);
            break;
          }
          case "topup.expire":
            await processExpiredTopUps();
            break;
          case "billing.scheduler":
            await runBillingScheduler();
            break;
          case "invoice.overdue": {
            const payload = job.payload as { invoiceId: string; userId: string };
            await handleInvoiceOverdue(payload);
            break;
          }
          case "service.renew": {
            const { serviceId } = job.payload as { serviceId: string };
            await renewService(serviceId);
            break;
          }
          case "billing.unpaid_check":
            await runUnpaidServiceChecker();
            break;
          default:
            console.log("Unknown job type:", job.type);
        }
        await completeJob(job.id);
      } catch (err) {
        await failJob(job, err instanceof Error ? err.message : "Unknown error");
      }
    } catch (err) {
      console.error("Worker loop error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

run();
