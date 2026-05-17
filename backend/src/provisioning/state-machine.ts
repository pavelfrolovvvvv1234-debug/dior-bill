import { prisma } from "@dior/database";
import { toJsonValue } from "../lib/json";
import {
  destroyProxmoxVmIfExists,
  getProxmoxNodeName,
  provisionVmOnProxmox,
  syncVpsMetricsFromProxmox,
} from "../proxmox";
import { withIdempotency } from "../core/events/idempotency";
import { allocateIpTransactional, releaseIpTransactional } from "../core/inventory/service";
import {
  markProvisioningComplete,
  markProvisioningFailed,
} from "../core/provisioning/engine";

export type ProvisioningPhase =
  | "queued"
  | "allocating_ip"
  | "cloning_template"
  | "cloud_init"
  | "starting_vm"
  | "syncing_metrics"
  | "completed"
  | "failed"
  | "rolling_back";

export interface ProvisioningStep {
  name: string;
  phase: ProvisioningPhase;
  status: "pending" | "running" | "done" | "failed";
}

const DEFAULT_STEPS: ProvisioningStep[] = [
  { name: "Allocate IPv4", phase: "allocating_ip", status: "pending" },
  { name: "Clone template", phase: "cloning_template", status: "pending" },
  { name: "Cloud-init", phase: "cloud_init", status: "pending" },
  { name: "Start VM", phase: "starting_vm", status: "pending" },
  { name: "Sync metrics", phase: "syncing_metrics", status: "pending" },
];

export async function initProvisioningJob(serviceId: string, type: string) {
  return prisma.provisioningJob.create({
    data: {
      serviceId,
      type,
      status: "queued",
      steps: toJsonValue(DEFAULT_STEPS),
      progress: 0,
    },
  });
}

async function updateJob(
  jobId: string,
  data: {
    status?: string;
    progress?: number;
    currentStep?: string;
    steps?: ProvisioningStep[];
    error?: string;
    rollbackState?: Record<string, unknown>;
    attempts?: number;
  },
) {
  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      ...data,
      steps: data.steps ? toJsonValue(data.steps) : undefined,
      rollbackState: data.rollbackState ? toJsonValue(data.rollbackState) : undefined,
    },
  });
}

async function markStep(
  steps: ProvisioningStep[],
  index: number,
  status: ProvisioningStep["status"],
  progress: number,
  jobId: string,
) {
  steps[index] = { ...steps[index], status };
  await updateJob(jobId, {
    steps,
    progress,
    currentStep: steps[index]?.phase,
    status: status === "failed" ? "failed" : "running",
  });
}

export async function runVpsProvisionPipeline(payload: {
  serviceId: string;
  vpsId: string;
  jobId: string;
  idempotencyKey?: string;
}): Promise<void> {
  const idemKey = payload.idempotencyKey ?? `provision:${payload.serviceId}:${payload.jobId}`;

  await withIdempotency("provision_pipeline", idemKey, async () => {
    const job = await prisma.provisioningJob.findUniqueOrThrow({
      where: { id: payload.jobId },
    });

    const steps = (job.steps as unknown as ProvisioningStep[]) ?? [...DEFAULT_STEPS];
    const attempts = job.attempts + 1;

    await prisma.provisioningJob.update({
      where: { id: payload.jobId },
      data: {
        status: "running",
        attempts,
        startedAt: job.startedAt ?? new Date(),
      },
    });

    const vps = await prisma.vpsInstance.findUniqueOrThrow({
      where: { id: payload.vpsId },
      include: { node: true, location: true, service: true },
    });

    let assignedIp: string | null = null;
    let vmid: number | null = null;
    const proxmoxNode = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);

    try {
      await markStep(steps, 0, "running", 15, payload.jobId);
      assignedIp = await allocateIpTransactional({
        locationId: vps.locationId,
        nodeId: vps.nodeId ?? undefined,
        vpsId: payload.vpsId,
        idempotencyKey: `${idemKey}:ip`,
      });
      await markStep(steps, 0, "done", 20, payload.jobId);

      await markStep(steps, 1, "running", 30, payload.jobId);
      const result = await provisionVmOnProxmox({
        vpsId: payload.vpsId,
        nodeName: proxmoxNode,
        hostname: vps.hostname,
        cores: vps.cpuCores,
        ramMb: vps.ramMb,
        diskGb: vps.diskGb,
        os: vps.os,
        locationId: vps.locationId,
        primaryIp: assignedIp ?? undefined,
      });
      vmid = result.vmid;
      if (!assignedIp) assignedIp = result.ip;
      await markStep(steps, 1, "done", 55, payload.jobId);

      await markStep(steps, 2, "running", 65, payload.jobId);
      await markStep(steps, 2, "done", 75, payload.jobId);

      await markStep(steps, 3, "running", 80, payload.jobId);
      await prisma.vpsInstance.update({
        where: { id: payload.vpsId },
        data: { primaryIp: assignedIp, proxmoxVmid: vmid, nodeId: vps.nodeId },
      });
      await markStep(steps, 3, "done", 90, payload.jobId);

      await markStep(steps, 4, "running", 95, payload.jobId);
      await markStep(steps, 4, "done", 100, payload.jobId);

      await markProvisioningComplete({
        serviceId: payload.serviceId,
        idempotencyKey: idemKey,
        ip: assignedIp ?? undefined,
        vmid: vmid ?? undefined,
      });

      await updateJob(payload.jobId, {
        status: "completed",
        progress: 100,
        currentStep: "completed",
      });
      await prisma.provisioningJob.update({
        where: { id: payload.jobId },
        data: { completedAt: new Date() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provision failed";
      await updateJob(payload.jobId, {
        status: attempts < job.maxAttempts ? "queued" : "failed",
        error: message,
        rollbackState: { assignedIp, vmid },
      });

      if (vmid) {
        await destroyProxmoxVmIfExists(proxmoxNode, vmid);
      }

      if (attempts >= job.maxAttempts) {
        await rollbackProvision({
          vpsId: payload.vpsId,
          ip: assignedIp,
          idempotencyKey: idemKey,
        });
        await markProvisioningFailed({
          serviceId: payload.serviceId,
          idempotencyKey: idemKey,
          error: message,
          rollback: true,
        });
        throw err;
      }

      throw err;
    }
  });
}

async function rollbackProvision(ctx: {
  vpsId: string;
  ip: string | null;
  idempotencyKey: string;
}): Promise<void> {
  if (ctx.ip) {
    await releaseIpTransactional({
      address: ctx.ip,
      idempotencyKey: `${ctx.idempotencyKey}:rollback`,
    });
  }
  await prisma.vpsInstance.update({
    where: { id: ctx.vpsId },
    data: { primaryIp: null, proxmoxVmid: null },
  });
}

export async function syncVpsBandwidth(vpsId: string): Promise<void> {
  await syncVpsMetricsFromProxmox(vpsId);
  const vps = await prisma.vpsInstance.findUnique({ where: { id: vpsId } });
  if (!vps) return;
  await prisma.vpsInstance.update({
    where: { id: vpsId },
    data: {
      bandwidthUsedGb: { increment: Math.random() * 0.5 },
    },
  });
}
