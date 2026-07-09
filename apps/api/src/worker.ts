import { loadMonorepoEnv } from "@dior/backend";
loadMonorepoEnv();

import {
  dequeueJob,
  completeJob,
  failJob,
  processExpiredTopUps,
  syncTopUpStatus,
  syncPendingTopUps,
  runVpsProvisionPipeline,
  syncVpsBandwidth,
  syncVpsIpFromProxmox,
  rebootVpsOnProxmox,
  reinstallVpsOnProxmox,
  processEventById,
  runReconciliation,
  runAllReconciliations,
  runUnpaidServiceChecker,
  runBillingScheduler,
  handleInvoiceOverdue,
  renewService,
  resumeAllStuckVpsProvisioning,
  reportOperationalIssue,
  purgePlaceholderIpsFromInventory,
  syncProxmoxUsedIpsToInventory,
  releaseStaleSharedRegistryReservations,
  reconcileSharedRegistryWithProxmox,
  isSharedIpRegistryEnabled,
  isSharedIpRegistryRequired,
  isProxmoxConfigured,
  syncProxmoxClusterToRegistry,
  resolveProxmoxNetwork,
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

let lastTopUpSync = 0;
const TOPUP_SYNC_INTERVAL_MS = 90 * 1000;

let lastWorkerErrorAlert = 0;
const WORKER_ERROR_ALERT_MS = 5 * 60 * 1000;

let lastProxmoxRegistrySync = 0;
const PROXMOX_REGISTRY_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function runProxmoxRegistrySyncIfDue(): Promise<void> {
  if (!isSharedIpRegistryEnabled() || !isProxmoxConfigured()) return;
  if (Date.now() - lastProxmoxRegistrySync < PROXMOX_REGISTRY_SYNC_INTERVAL_MS) return;
  lastProxmoxRegistrySync = Date.now();
  try {
    const network = await resolveProxmoxNetwork("debian12");
    const r = await syncProxmoxClusterToRegistry(network, { force: true });
    console.log(
      `[shared-ip] periodic Proxmox sync: ${r.occupied.size} IPs, ${r.vmCount} VMs, ` +
        `+${r.imported} new, ${r.reactivated} reactivated`,
    );
  } catch (e) {
    console.error("Proxmox registry periodic sync:", e);
  }
}
let lastStaleIpCleanup = 0;
const STALE_IP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastSharedIpReconcile = 0;
const SHARED_IP_RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function run() {
  console.log("Dior worker started (event-driven control plane)");
  console.log(
    `[worker] proxmox=${isProxmoxConfigured() ? "yes" : "NO"} ` +
      `sharedIpRegistry=${isSharedIpRegistryEnabled() ? "yes" : "no"} ` +
      `requireRegistry=${isSharedIpRegistryRequired() ? "yes" : "no"} ` +
      `cwd=${process.cwd()}`,
  );
  if (isSharedIpRegistryRequired() && !isProxmoxConfigured()) {
    console.warn(
      "[worker] PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 but Proxmox API creds missing — " +
        "IP reserve uses registry; VM create will fail until PROXMOX_BASE_URL/TOKEN_* are set",
    );
  }
  if (!isProxmoxConfigured() && !isSharedIpRegistryRequired()) {
    console.warn(
      "[worker] Proxmox not configured — VPS provision will use legacy ip_addresses table " +
        '("No IPv4 addresses available" if pool is empty). Stop duplicate Docker worker if PM2 is primary.',
    );
  }
  setTimeout(() => {
    resumeAllStuckVpsProvisioning().catch((e) =>
      console.error("Initial stuck VPS resume:", e),
    );
  }, 60_000);
  purgePlaceholderIpsFromInventory()
    .then((n) => n > 0 && console.log(`Purged ${n} placeholder IPs from inventory`))
    .catch((e) => console.error("Placeholder IP purge:", e));
  syncProxmoxUsedIpsToInventory()
    .then((r) =>
      console.log(
        `Proxmox IP sync: ${r.used} occupied, ${r.reserved} reserved in DB, next free ${r.nextFree ?? "none"}`,
      ),
    )
    .catch((e) => console.error("Proxmox IP occupancy sync:", e));
  if (isSharedIpRegistryEnabled()) {
    resolveProxmoxNetwork("debian12")
      .then((network) => syncProxmoxClusterToRegistry(network, { force: true }))
      .then((r) =>
        console.log(
          `[shared-ip] startup Proxmox sync: ${r.occupied.size} IPs, ${r.vmCount} VMs, ` +
            `+${r.imported} new, ${r.reactivated} reactivated`,
        ),
      )
      .catch((e) => console.error("Proxmox registry startup sync:", e));
    reconcileSharedRegistryWithProxmox()
      .then((r) =>
        console.log(
          `[shared-ip] startup reconcile: stale=${r.staleReserved} ghost=${r.releasedGhost} imported=${r.imported}`,
        ),
      )
      .catch((e) => console.error("Shared IP registry reconcile:", e));
  }
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

      if (Date.now() - lastTopUpSync > TOPUP_SYNC_INTERVAL_MS) {
        lastTopUpSync = Date.now();
        syncPendingTopUps().catch((e) => console.error("Top-up sync error:", e));
      }

      if (isSharedIpRegistryEnabled()) {
        await runProxmoxRegistrySyncIfDue();
        if (Date.now() - lastStaleIpCleanup > STALE_IP_CLEANUP_INTERVAL_MS) {
          lastStaleIpCleanup = Date.now();
          releaseStaleSharedRegistryReservations().catch((e) =>
            console.error("Stale shared IP cleanup:", e),
          );
        }
        if (Date.now() - lastSharedIpReconcile > SHARED_IP_RECONCILE_INTERVAL_MS) {
          lastSharedIpReconcile = Date.now();
          reconcileSharedRegistryWithProxmox().catch((e) =>
            console.error("Shared IP daily reconcile:", e),
          );
        }
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
          case "vps.sync_ip": {
            const { vpsId } = job.payload as { vpsId: string };
            await syncVpsIpFromProxmox(vpsId);
            break;
          }
          case "vps.ensure_access": {
            const payload = job.payload as {
              vpsId: string;
              reboot?: boolean;
              forceStop?: boolean;
              repairNetwork?: boolean;
            };
            if (payload.repairNetwork) {
              const { runVpsNetworkRepairJob } = await import("@dior/backend");
              await runVpsNetworkRepairJob(payload.vpsId);
            } else {
              const { ensureVpsProxmoxAccess } = await import("@dior/backend");
              await ensureVpsProxmoxAccess(payload.vpsId, {
                reboot: payload.reboot !== false,
                waitForGuest: false,
                forceStop: payload.forceStop === true,
              });
            }
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
        const message = err instanceof Error ? err.message : "Unknown error";
        if (job.type === "vps.provision") {
          // Pipeline manages DB job retries — avoid duplicate Redis re-queue.
          await completeJob(job.id);
          console.error(`[worker] vps.provision failed:`, message);
        } else {
          await failJob(job, message);
        }
      }
    } catch (err) {
      console.error("Worker loop error:", err);
      if (Date.now() - lastWorkerErrorAlert > WORKER_ERROR_ALERT_MS) {
        lastWorkerErrorAlert = Date.now();
        reportOperationalIssue({
          category: "worker.loop",
          message: err instanceof Error ? err.message : "Unknown worker error",
          severity: "critical",
          dedupeKey: `worker_loop:${(err instanceof Error ? err.message : "unknown")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120)}`,
        }).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

run();
