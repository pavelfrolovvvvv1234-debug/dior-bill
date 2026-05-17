import type { QueueJobType } from "@dior/shared";

const BACKGROUND_JOB_TYPES = new Set<QueueJobType>([
  "vps.provision",
  "vps.reboot",
  "vps.reinstall",
  "vps.sync_metrics",
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
    default:
      break;
  }
}

export function shouldRunInlineJobInBackground(type: QueueJobType): boolean {
  return BACKGROUND_JOB_TYPES.has(type);
}
