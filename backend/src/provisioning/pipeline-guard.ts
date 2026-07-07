import { prisma } from "@dior/database";
import { resolveProxmoxCiUser } from "../proxmox/config";

/** Stable idempotency key — one successful provision per service. */
export function provisionPipelineKey(serviceId: string): string {
  return `provision:${serviceId}`;
}

/** Stale pipeline cache blocks all retries after a failed attempt — clear before re-run. */
export async function clearProvisionPipelineIdempotency(serviceId: string): Promise<void> {
  const key = provisionPipelineKey(serviceId);
  await prisma.processedIdempotencyKey.deleteMany({
    where: {
      scope: "provision_pipeline",
      OR: [{ key }, { key: { startsWith: `${key}:` } }],
    },
  });
}

const RUNNING_JOB_TTL_MS = 25 * 60 * 1000;
const RECOVERY_MIN_UPTIME_SEC = 90;

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

/**
 * VM exists on Proxmox — finish lifecycle without re-clone.
 * Never reboots: stop/start during first-boot cloud-init breaks SSH.
 */
export async function tryCompleteStuckProvisionedVps(serviceId: string): Promise<boolean> {
  try {
    return await tryCompleteStuckProvisionedVpsInner(serviceId);
  } catch (err) {
    console.warn(
      `[provision] recover skipped for ${serviceId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function tryCompleteStuckProvisionedVpsInner(serviceId: string): Promise<boolean> {
  const row = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      vpsInstance: {
        include: { node: true },
      },
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const vps = row?.vpsInstance;
  if (!row || row.status === "ACTIVE" || !vps) return false;

  const { getProxmoxClient, getProxmoxNodeName } = await import("../proxmox/client");
  const { isProxmoxConfigured } = await import("../proxmox/config");
  const { findProxmoxVmidByHostname } = await import("../proxmox");
  if (!isProxmoxConfigured()) return false;

  const client = getProxmoxClient();
  if (!client) return false;

  const nodeName = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  let vmid = vps.proxmoxVmid;
  let primaryIp = vps.primaryIp;

  if (!vmid || !(await client.vmConfigExists(nodeName, vmid))) {
    const linked = await findProxmoxVmidByHostname(vps.hostname, nodeName);
    if (!linked) return false;
    vmid = linked.vmid;
    await prisma.vpsInstance.update({
      where: { id: vps.id },
      data: { proxmoxVmid: vmid },
    });
  }

  if (!primaryIp) {
    try {
      const cfg = await client.getVmConfig(nodeName, vmid);
      primaryIp = client.parseIpFromConfig(cfg) ?? null;
      if (!primaryIp) {
        const ips = await client.getGuestAgentIps(nodeName, vmid);
        primaryIp = ips[0] ?? null;
      }
      if (primaryIp) {
        await prisma.vpsInstance.update({
          where: { id: vps.id },
          data: { primaryIp },
        });
      }
    } catch {
      return false;
    }
  }

  if (!primaryIp || !vps.rootPasswordEnc) return false;

  let cfg: Record<string, string>;
  try {
    cfg = await client.getVmConfig(nodeName, vmid);
  } catch {
    return false;
  }
  const pveIp = client.parseIpFromConfig(cfg);
  const ciuser = resolveProxmoxCiUser(vps.os);
  if (!cfg.ipconfig0 || pveIp !== primaryIp || cfg.ciuser?.trim() !== ciuser) {
    return false;
  }
  if ((cfg.net0 ?? "").includes("firewall=1")) {
    return false;
  }

  const vmStatus = await client.getVmStatus(nodeName, vmid).catch(() => ({ status: "unknown" }));
  if (vmStatus.status !== "running") {
    try {
      await client.startVm(nodeName, vmid);
    } catch {
      return false;
    }
    return false;
  }

  const uptime = await client.getVmUptimeSec(nodeName, vmid);
  if (uptime < RECOVERY_MIN_UPTIME_SEC) {
    return false;
  }

  const guestIps = await client.getGuestAgentIps(nodeName, vmid).catch(() => [] as string[]);
  if (!guestIps.includes(primaryIp)) {
    console.log(
      `[provision] recover skip ${vps.hostname} — guest IP not ${primaryIp} (agent: ${guestIps.join(",") || "down"})`,
    );
    return false;
  }

  const { markProvisioningComplete } = await import("../core/provisioning/engine");
  const {
    activateSharedRegistryIp,
    isSharedIpRegistryEnabled,
    isSharedIpRegistryRequired,
  } = await import("../proxmox/shared-ip-registry");

  if (isSharedIpRegistryRequired() || isSharedIpRegistryEnabled()) {
    await activateSharedRegistryIp({
      ip: primaryIp,
      vmid,
      vpsId: vps.id,
      hostname: vps.hostname,
    });
  }

  await markProvisioningComplete({
    serviceId,
    idempotencyKey: `${provisionPipelineKey(serviceId)}:recover`,
    ip: primaryIp,
    vmid,
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
    `[provision] recovered → ACTIVE (no reboot): ${vps.hostname} vmid=${vmid} ip=${primaryIp}`,
  );
  return true;
}
