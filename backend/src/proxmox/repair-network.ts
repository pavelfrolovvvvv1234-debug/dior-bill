import { prisma } from "@dior/database";
import { decrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName, type VmSpec } from "./client";
import { getProxmoxConfig, resolveProxmoxCiUser } from "./config";
import { getProxmoxGateway } from "./ip-pool";
import { waitForVpsProvisionReady } from "./provision-ready";
import { markProvisioningComplete } from "../core/provisioning/engine";
import { provisionPipelineKey } from "../provisioning/pipeline-guard";

/**
 * Stop → re-apply cloud-init (net0 firewall=0, ide2) → start.
 * Used when first boot did not bring up guest network / SSH.
 */
export async function repairVpsCloudInitNetwork(
  vmSpec: VmSpec & { os?: string },
): Promise<boolean> {
  const client = getProxmoxClient();
  const config = getProxmoxConfig();
  if (!client || !config || !vmSpec.primaryIp) return false;

  const { node, vmid, primaryIp } = vmSpec;
  console.log(`[proxmox] repair cloud-init network vmid=${vmid} ip=${primaryIp}`);

  try {
    const st = await client.getVmStatus(node, vmid);
    if (st.status === "running") {
      await client.stopVm(node, vmid);
    }
  } catch {
    /* may already be stopped */
  }

  await client.ensureCloudInitDrive(node, vmid, config.storage).catch((e) => {
    console.warn(
      `[proxmox] ensureCloudInitDrive vmid ${vmid}:`,
      e instanceof Error ? e.message : e,
    );
  });
  await client.configureVm({
    ...vmSpec,
    ciuser: vmSpec.ciuser ?? resolveProxmoxCiUser(vmSpec.os ?? "debian-12"),
    gateway: vmSpec.gateway ?? config.gateway ?? getProxmoxGateway(),
    ipCidr: vmSpec.ipCidr ?? config.ipCidr,
    bridge: vmSpec.bridge ?? config.bridge,
    storage: vmSpec.storage ?? config.storage,
  });
  await client.regenerateCloudInit(node, vmid);
  await client.startVm(node, vmid);

  return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
}

/** Worker job: stop → fix cloud-init → start; complete service if guest IP OK. */
export async function runVpsNetworkRepairJob(vpsId: string): Promise<boolean> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true, service: true },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) return false;

  const config = getProxmoxConfig();
  if (!config) return false;

  let password: string;
  try {
    if (!vps.rootPasswordEnc) return false;
    password = decrypt(vps.rootPasswordEnc);
  } catch {
    return false;
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const ready = await repairVpsCloudInitNetwork({
    vmid: vps.proxmoxVmid,
    node,
    hostname: vps.hostname,
    cores: vps.cpuCores,
    memoryMb: vps.ramMb,
    diskGb: vps.diskGb,
    templateVmid: 0,
    primaryIp: vps.primaryIp,
    gateway: config.gateway ?? getProxmoxGateway(),
    ipCidr: config.ipCidr,
    rootPassword: password,
    ciuser: resolveProxmoxCiUser(vps.os),
    storage: config.storage,
    bridge: config.bridge,
    os: vps.os,
  });

  if (ready && vps.service.status === "PROVISIONING") {
    await markProvisioningComplete({
      serviceId: vps.serviceId,
      idempotencyKey: `${provisionPipelineKey(vps.serviceId)}:network-repair`,
      ip: vps.primaryIp,
      vmid: vps.proxmoxVmid,
    });
  }

  return ready;
}
