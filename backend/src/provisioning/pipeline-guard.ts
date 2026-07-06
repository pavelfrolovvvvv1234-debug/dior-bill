import { prisma } from "@dior/database";

/** Stable idempotency key — one successful provision per service. */
export function provisionPipelineKey(serviceId: string): string {
  return `provision:${serviceId}`;
}

const RUNNING_JOB_TTL_MS = 25 * 60 * 1000;

/** Another worker/job is already cloning this VPS — skip duplicate pipeline. */
export async function isDuplicateProvisionRun(params: {
  serviceId: string;
  jobId: string;
}): Promise<boolean> {
  const other = await prisma.provisioningJob.findFirst({
    where: {
      serviceId: params.serviceId,
      status: "running",
      id: { not: params.jobId },
      startedAt: { gt: new Date(Date.now() - RUNNING_JOB_TTL_MS) },
    },
    select: { id: true },
  });
  if (other) {
    console.log(
      `[provision] skip duplicate — job ${other.id} already running for service ${params.serviceId}`,
    );
    return true;
  }
  return false;
}

/** VM exists in DB + on Proxmox — finish lifecycle without re-clone. */
export async function tryCompleteStuckProvisionedVps(serviceId: string): Promise<boolean> {
  const row = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      vpsInstance: {
        select: {
          id: true,
          proxmoxVmid: true,
          primaryIp: true,
          rootPasswordEnc: true,
          hostname: true,
        },
      },
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const vps = row?.vpsInstance;
  if (!row || row.status === "ACTIVE" || !vps?.proxmoxVmid || !vps.primaryIp) {
    return false;
  }
  if (!vps.rootPasswordEnc) return false;

  const { getProxmoxClient, getProxmoxNodeName } = await import("../proxmox/client");
  const { isProxmoxConfigured } = await import("../proxmox/config");
  if (!isProxmoxConfigured()) return false;

  const client = getProxmoxClient();
  if (!client) return false;

  const vpsFull = await prisma.vpsInstance.findUnique({
    where: { serviceId },
    include: { node: true },
  });
  if (!vpsFull?.proxmoxVmid) return false;

  const nodeName = getProxmoxNodeName(vpsFull.node?.proxmoxNode ?? vpsFull.node?.name);
  if (!(await client.vmConfigExists(nodeName, vpsFull.proxmoxVmid))) return false;

  const { markProvisioningComplete } = await import("../core/provisioning/engine");
  const {
    activateSharedRegistryIp,
    isSharedIpRegistryEnabled,
    isSharedIpRegistryRequired,
  } = await import("../proxmox/shared-ip-registry");

  if (isSharedIpRegistryRequired() || isSharedIpRegistryEnabled()) {
    await activateSharedRegistryIp({
      ip: vps.primaryIp,
      vmid: vps.proxmoxVmid,
      vpsId: vps.id,
      hostname: vps.hostname,
    });
  }

  await markProvisioningComplete({
    serviceId,
    idempotencyKey: `${provisionPipelineKey(serviceId)}:recover`,
    ip: vps.primaryIp,
    vmid: vps.proxmoxVmid,
  });

  const job = row.provisioningJobs[0];
  if (job) {
    await prisma.provisioningJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        progress: 100,
        currentStep: "completed",
        error: null,
        completedAt: new Date(),
      },
    });
  }

  console.log(
    `[provision] recovered stuck ACTIVE path for ${vps.hostname} vmid=${vps.proxmoxVmid} ip=${vps.primaryIp}`,
  );
  return true;
}
