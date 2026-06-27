import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { destroyProxmoxVmIfExists, getProxmoxNodeName } from "../src/proxmox";
import { runVpsProvisionPipeline } from "../src/provisioning/state-machine";

loadMonorepoEnv();

async function main() {
  const hostname = process.argv[2];
  const vps = await prisma.vpsInstance.findFirst({
    where: hostname ? { hostname } : undefined,
    orderBy: { createdAt: "desc" },
    include: { service: true, node: true },
  });
  if (!vps) throw new Error("VPS not found");

  const job = await prisma.provisioningJob.findFirst({
    where: { serviceId: vps.serviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) throw new Error("No provisioning job");

  console.log("Retrying", vps.hostname, "job", job.id, "status", job.status, job.error);

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  for (const orphanId of [164, 165, 166, 167]) {
    await destroyProxmoxVmIfExists(node, orphanId);
  }
  if (vps.proxmoxVmid) {
    await destroyProxmoxVmIfExists(node, vps.proxmoxVmid);
  }

  await prisma.provisioningJob.update({
    where: { id: job.id },
    data: { status: "queued", error: null, attempts: 0 },
  });

  await runVpsProvisionPipeline({
    serviceId: vps.serviceId,
    vpsId: vps.id,
    jobId: job.id,
    idempotencyKey: `manual-retry:${job.id}`,
  });

  const after = await prisma.service.findUnique({
    where: { id: vps.serviceId },
    include: { vpsInstance: true },
  });
  console.log("Result:", after?.status, after?.vpsInstance?.primaryIp, after?.vpsInstance?.proxmoxVmid);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
