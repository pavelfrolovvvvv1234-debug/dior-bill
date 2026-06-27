import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { transitionServiceLifecycle } from "../core/provisioning/engine";
import { destroyProxmoxVmIfExists, getProxmoxClient, getProxmoxNodeName } from "../proxmox";
import { runVpsProvisionPipeline } from "./state-machine";

function proxmoxVmName(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9.-]/g, "-").slice(0, 63);
}

/** Remove VMs left on Proxmox after interrupted clone (DB may have no vmid). */
async function destroyOrphanVmByHostname(node: string, hostname: string): Promise<void> {
  const client = getProxmoxClient();
  if (!client) return;
  const expected = proxmoxVmName(hostname);
  try {
    const vms = await client.listVms(node);
    for (const vm of vms) {
      const name = vm.name ?? "";
      if (name === expected || name === hostname) {
        console.log(`[retry] removing orphan VM ${vm.vmid} (${name}) on ${node}`);
        await destroyProxmoxVmIfExists(node, vm.vmid);
      }
    }
  } catch (e) {
    console.warn("[retry] orphan VM scan failed:", e instanceof Error ? e.message : e);
  }
}

export async function retryVpsProvisioningForInstance(params: {
  hostname?: string;
  serviceId?: string;
}): Promise<{ hostname: string; status: string; ip: string | null; vmid: number | null }> {
  const vps = await prisma.vpsInstance.findFirst({
    where: params.serviceId
      ? { serviceId: params.serviceId }
      : params.hostname
        ? {
            OR: [{ hostname: params.hostname }, { service: { label: params.hostname } }],
          }
        : undefined,
    orderBy: { createdAt: "desc" },
    include: { service: true, node: true },
  });

  if (!vps) {
    const recent = await prisma.vpsInstance.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { hostname: true, service: { select: { status: true } } },
    });
    const hint =
      recent.length > 0
        ? `Recent: ${recent.map((r) => `${r.hostname} (${r.service.status})`).join(", ")}`
        : "No VPS in database.";
    throw new NotFoundError(
      params.hostname ? `VPS not found for "${params.hostname}". ${hint}` : `VPS not found. ${hint}`,
    );
  }

  const job = await prisma.provisioningJob.findFirst({
    where: { serviceId: vps.serviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) throw new NotFoundError("No provisioning job for this VPS");

  const fresh = await prisma.service.findUnique({ where: { id: vps.serviceId } });
  const status = fresh?.status ?? vps.service.status;
  if (status === "ROLLBACK" || status === "FAILED" || status === "PENDING") {
    await transitionServiceLifecycle({
      serviceId: vps.serviceId,
      to: "PROVISIONING",
      reason: "Provisioning retry",
      idempotencyKey: `retry:lifecycle:${job.id}:${Date.now()}`,
    });
  } else if (status !== "PROVISIONING") {
    throw new ValidationError(`Cannot retry provisioning from status ${status}`);
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  await destroyOrphanVmByHostname(node, vps.hostname);
  if (vps.proxmoxVmid) {
    await destroyProxmoxVmIfExists(node, vps.proxmoxVmid);
    await prisma.vpsInstance.update({
      where: { id: vps.id },
      data: { proxmoxVmid: null },
    });
  }

  await prisma.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      error: null,
      attempts: 0,
      progress: 0,
      currentStep: null,
      completedAt: null,
      maxAttempts: Math.max(job.maxAttempts, 5),
    },
  });

  console.log(
    `[retry] ${vps.hostname} — cloning VM on Proxmox (can take up to 15 min). Do not interrupt.`,
  );

  await runVpsProvisionPipeline({
    serviceId: vps.serviceId,
    vpsId: vps.id,
    jobId: job.id,
    idempotencyKey: `manual-retry:${job.id}:${Date.now()}`,
  });

  const after = await prisma.service.findUnique({
    where: { id: vps.serviceId },
    include: { vpsInstance: true },
  });

  return {
    hostname: vps.hostname,
    status: after?.status ?? "unknown",
    ip: after?.vpsInstance?.primaryIp ?? null,
    vmid: after?.vpsInstance?.proxmoxVmid ?? null,
  };
}
