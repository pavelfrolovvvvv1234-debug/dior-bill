import { prisma } from "@dior/database";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import { clearProvisionPipelineIdempotency } from "../provisioning/pipeline-guard";
import { runVpsProvisionPipeline, initProvisioningJob } from "../provisioning/state-machine";
import { transitionServiceLifecycle } from "../core/provisioning/engine";

async function destroyVmOnNode(node: string, vmid: number): Promise<void> {
  const client = getProxmoxClient();
  if (!client) return;
  try {
    await client.stopVm(node, vmid);
  } catch {
    /* not running */
  }
  try {
    await client.deleteVm(node, vmid);
  } catch {
    /* already gone */
  }
  try {
    await client.waitUntilVmidGone(node, vmid, 120_000);
  } catch (err) {
    console.warn(
      `[proxmox] vmid ${vmid} destroy wait:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Destroy VM disk and re-clone from template (same IP in DB/registry).
 * Only reliable fix when hypervisor ipconfig0 is OK but guest SSH/network is dead.
 */
export async function rebuildVpsKeepingIp(vpsId: string): Promise<{
  vmid: number | null;
  ip: string | null;
  status: string;
}> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { service: true, node: true },
  });
  if (!vps) {
    throw new Error(`VPS not found: ${vpsId}`);
  }

  const client = getProxmoxClient();
  if (!client) {
    throw new Error("Proxmox not configured");
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  console.log(
    `[proxmox] fresh rebuild ${vps.hostname} — keep IP ${vps.primaryIp ?? "?"} destroy vmid ${vps.proxmoxVmid ?? "?"}`,
  );

  if (vps.proxmoxVmid) {
    await destroyVmOnNode(node, vps.proxmoxVmid);
    await prisma.vpsInstance.update({
      where: { id: vps.id },
      data: { proxmoxVmid: null },
    });
  }

  await clearProvisionPipelineIdempotency(vps.serviceId);

  if (vps.service.status === "ACTIVE") {
    await transitionServiceLifecycle({
      serviceId: vps.serviceId,
      to: "REINSTALLING",
      reason: "Fresh rebuild — guest cloud-init broken",
      idempotencyKey: `rebuild:${vps.id}:${Date.now()}`,
    });
  }

  let job = await prisma.provisioningJob.findFirst({
    where: { serviceId: vps.serviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    job = await initProvisioningJob(vps.serviceId, "vps.provision");
  }

  await prisma.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      error: null,
      attempts: 0,
      progress: 0,
      completedAt: null,
    },
  });

  console.log("[proxmox] cloning fresh VM (5–15 min). Do NOT interrupt.");
  await runVpsProvisionPipeline({
    serviceId: vps.serviceId,
    vpsId: vps.id,
    jobId: job.id,
    idempotencyKey: `rebuild-fresh:${job.id}:${Date.now()}`,
  });

  const after = await prisma.vpsInstance.findUnique({ where: { id: vps.id } });
  const svc = await prisma.service.findUnique({ where: { id: vps.serviceId } });
  return {
    vmid: after?.proxmoxVmid ?? null,
    ip: after?.primaryIp ?? null,
    status: svc?.status ?? "unknown",
  };
}
