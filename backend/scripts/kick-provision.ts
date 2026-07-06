/**
 * Unstick a VPS stuck in PROVISIONING (clears pipeline idempotency cache + re-queues).
 * Usage: pnpm exec tsx scripts/kick-provision.ts serv
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import {
  clearProvisionPipelineIdempotency,
  provisionPipelineKey,
  tryCompleteStuckProvisionedVps,
} from "../src/provisioning/pipeline-guard";
import { enqueueJob } from "../src/lib/queue";

loadMonorepoEnv();

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/kick-provision.ts <hostname>");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
    include: { service: true },
  });
  if (!vps) {
    console.error(`VPS not found: ${name}`);
    process.exit(1);
  }

  console.log(`${vps.hostname} status=${vps.service.status} ip=${vps.primaryIp} vmid=${vps.proxmoxVmid}`);

  if (await tryCompleteStuckProvisionedVps(vps.serviceId)) {
    console.log("Recovered → ACTIVE (VM already on Proxmox)");
    await prisma.$disconnect();
    return;
  }

  if (vps.service.status === "ACTIVE") {
    console.log("Already ACTIVE");
    await prisma.$disconnect();
    return;
  }

  let job = await prisma.provisioningJob.findFirst({
    where: { serviceId: vps.serviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    const { initProvisioningJob } = await import("../src/provisioning/state-machine");
    job = await initProvisioningJob(vps.serviceId, "vps.provision");
  }

  await clearProvisionPipelineIdempotency(vps.serviceId);
  await prisma.provisioningJob.update({
    where: { id: job.id },
    data: { status: "queued", error: null, progress: 0 },
  });

  await enqueueJob("vps.provision", {
    serviceId: vps.serviceId,
    vpsId: vps.id,
    jobId: job.id,
    idempotencyKey: provisionPipelineKey(vps.serviceId),
  });

  console.log(`Queued provision job ${job.id} — watch: pm2 logs dior-worker`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
