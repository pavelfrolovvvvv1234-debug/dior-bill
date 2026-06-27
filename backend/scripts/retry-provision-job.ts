import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { destroyProxmoxVmIfExists, getProxmoxNodeName } from "../src/proxmox";
import { runVpsProvisionPipeline } from "../src/provisioning/state-machine";

loadMonorepoEnv();

function parseHostnameArg(): string | undefined {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const hostname = args[0]?.trim();
  return hostname || undefined;
}

async function main() {
  const hostname = parseHostnameArg();
  const vps = await prisma.vpsInstance.findFirst({
    where: hostname
      ? {
          OR: [
            { hostname },
            { service: { label: hostname } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { service: true, node: true },
  });
  if (!vps) {
    const recent = await prisma.vpsInstance.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { hostname: true, service: { select: { label: true, status: true } } },
    });
    const hint =
      recent.length > 0
        ? `Recent hostnames: ${recent.map((r) => `${r.hostname} (${r.service.status})`).join(", ")}`
        : "No VPS instances in database.";
    throw new Error(hostname ? `VPS not found for "${hostname}". ${hint}` : `VPS not found. ${hint}`);
  }

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
