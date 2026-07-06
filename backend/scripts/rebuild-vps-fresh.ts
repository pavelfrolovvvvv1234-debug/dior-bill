/**
 * Destroy broken VM and re-clone from template (same IP) — fixes cloud-init / SSH timeout.
 * Usage: pm2 stop dior-worker && pnpm exec tsx scripts/rebuild-vps-fresh.ts serv
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import {
  destroyProxmoxVmIfExists,
  getProxmoxClient,
  getProxmoxNodeName,
  isProxmoxConfigured,
} from "../src/proxmox";
import { clearProvisionPipelineIdempotency } from "../src/provisioning/pipeline-guard";
import { runVpsProvisionPipeline } from "../src/provisioning/state-machine";
import { transitionServiceLifecycle } from "../src/core/provisioning/engine";

loadMonorepoEnv();

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/rebuild-vps-fresh.ts <hostname>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
    include: { service: true, node: true },
  });
  if (!vps) {
    console.error(`VPS not found: ${name}`);
    process.exit(1);
  }

  const ip = vps.primaryIp;
  console.log(`Rebuild ${vps.hostname} — keep IP ${ip ?? "?"} destroy vmid ${vps.proxmoxVmid ?? "?"}`);

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const client = getProxmoxClient()!;

  if (vps.proxmoxVmid) {
    console.log(`Destroying vmid ${vps.proxmoxVmid} on ${node}...`);
    await destroyProxmoxVmIfExists(node, vps.proxmoxVmid);
    await client.waitUntilVmidGone(node, vps.proxmoxVmid, 120_000);
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
      reason: "Fresh rebuild — cloud-init first boot",
      idempotencyKey: `rebuild:${vps.id}:${Date.now()}`,
    });
  }

  let job = await prisma.provisioningJob.findFirst({
    where: { serviceId: vps.serviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    const { initProvisioningJob } = await import("../src/provisioning/state-machine");
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

  console.log("Cloning fresh VM (5–15 min). IP stays in DB/registry — do NOT interrupt.");
  await runVpsProvisionPipeline({
    serviceId: vps.serviceId,
    vpsId: vps.id,
    jobId: job.id,
    idempotencyKey: `rebuild-fresh:${job.id}:${Date.now()}`,
  });

  const after = await prisma.vpsInstance.findUnique({ where: { id: vps.id } });
  const svc = await prisma.service.findUnique({ where: { id: vps.serviceId } });
  console.log(
    `Done: status=${svc?.status} ip=${after?.primaryIp} vmid=${after?.proxmoxVmid} — wait 2 min then PuTTY`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
