import { prisma } from "@dior/database";
import { decrypt } from "../lib/crypto";
import { getProxmoxConfig, resolveProxmoxCiUser } from "./config";
import { getProxmoxGateway } from "./ip-pool";
import { getProxmoxNodeName } from "./client";
import { repairVpsCloudInitNetwork } from "./repair-network";
import { markProvisioningComplete } from "../core/provisioning/engine";
import { provisionPipelineKey } from "../provisioning/pipeline-guard";

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
