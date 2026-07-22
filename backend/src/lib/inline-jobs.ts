import type { QueueJobType } from "@dior/shared";

const BACKGROUND_JOB_TYPES = new Set<QueueJobType>([
  "vps.provision",
  "vps.reboot",
  "vps.reinstall",
  "vps.sync_metrics",
  "vps.sync_ip",
  "vps.ensure_access",
  "reconciliation.run",
]);

/** Run queue work in-process when Redis is disabled (local dev). */
export async function dispatchInlineJob(
  type: QueueJobType,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case "event.process": {
      const { processEventById } = await import("../core/events/handlers");
      await processEventById(payload.eventId as string);
      break;
    }
    case "vps.provision": {
      const { runVpsProvisionPipeline } = await import("../provisioning/state-machine");
      await runVpsProvisionPipeline(
        payload as {
          serviceId: string;
          vpsId: string;
          jobId: string;
          idempotencyKey?: string;
        },
      );
      break;
    }
    case "vps.reboot": {
      const { rebootVpsOnProxmox } = await import("../proxmox");
      await rebootVpsOnProxmox(payload.vpsId as string);
      break;
    }
    case "vps.reinstall": {
      const { reinstallVpsOnProxmox } = await import("../proxmox");
      const { prisma } = await import("@dior/database");
      const vps = await prisma.vpsInstance.findUnique({
        where: { id: payload.vpsId as string },
        select: { service: { select: { userId: true } } },
      });
      if (vps) {
        await reinstallVpsOnProxmox(
          payload.vpsId as string,
          (payload.userId as string) ?? vps.service.userId,
          payload.os as string | undefined,
        );
      }
      break;
    }
    case "vps.sync_metrics": {
      const { syncVpsBandwidth } = await import("../provisioning/state-machine");
      await syncVpsBandwidth(payload.vpsId as string);
      break;
    }
    case "vps.sync_ip": {
      const { syncVpsIpFromProxmox } = await import("../proxmox");
      await syncVpsIpFromProxmox(payload.vpsId as string);
      break;
    }
    case "vps.ensure_access": {
      const { ensureVpsProxmoxAccess } = await import("../proxmox/ensure-vps-access");
      const { runVpsNetworkRepairJob } = await import("../proxmox/repair-network");
      const { syncGuestPasswordForVps } = await import("../proxmox/guest-access");
      if (payload.repairNetwork === true) {
        await runVpsNetworkRepairJob(payload.vpsId as string);
      } else if (payload.syncGuestPassword === true) {
        await syncGuestPasswordForVps(payload.vpsId as string);
      } else {
        await ensureVpsProxmoxAccess(payload.vpsId as string, {
          reboot: payload.reboot !== false,
          waitForGuest: false,
          forceStop: payload.forceStop === true,
        });
        // Always push panel password into guest after cloud-init path.
        await syncGuestPasswordForVps(payload.vpsId as string).catch((e) => {
          console.warn(
            `[inline-job] ensure_access password sync:`,
            e instanceof Error ? e.message.slice(0, 160) : e,
          );
          throw e;
        });
      }
      break;
    }
    case "payment.retry": {
      const { syncTopUpStatus } = await import("../payments/topup");
      const topUpId = payload.topUpId as string | undefined;
      if (topUpId) await syncTopUpStatus(topUpId);
      break;
    }
    default:
      break;
  }
}

export function shouldRunInlineJobInBackground(type: QueueJobType): boolean {
  return BACKGROUND_JOB_TYPES.has(type);
}
