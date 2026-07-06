import { prisma } from "@dior/database";
import { releaseIpTransactional } from "../core/inventory/service";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import {
  releaseSharedRegistryIp,
  releaseSharedRegistryIpByVpsId,
  isSharedIpRegistryEnabled,
} from "./shared-ip-registry";

async function shouldReleaseRegistryIp(
  vps: { id: string; proxmoxVmid: number | null; primaryIp: string | null; node: { proxmoxNode: string | null; name: string } | null },
  ip: string,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return true;

  const prefix = ip.split(".").slice(0, 3).join(".");
  const inUse = await client.isIpInUseOnCluster(ip, prefix);
  if (!inUse) return true;

  if (vps.proxmoxVmid) {
    const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
    if (await client.vmConfigExists(node, vps.proxmoxVmid)) {
      console.warn(
        `[shared-ip] skip release ${ip} — VMID ${vps.proxmoxVmid} still on Proxmox`,
      );
      return false;
    }
  }

  return true;
}

/**
 * Release billing IP inventory + shared registry row when a VPS is removed.
 */
export async function teardownVpsNetworkResources(params: {
  vpsId: string;
  destroyVm?: boolean;
  idempotencyKey?: string;
}): Promise<void> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: params.vpsId },
    include: { node: true },
  });
  if (!vps) return;

  if (params.destroyVm && vps.proxmoxVmid) {
    const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
    const { destroyProxmoxVmIfExists } = await import("./index");
    await destroyProxmoxVmIfExists(node, vps.proxmoxVmid);
  }

  if (isSharedIpRegistryEnabled()) {
    if (vps.primaryIp) {
      if (await shouldReleaseRegistryIp(vps, vps.primaryIp)) {
        await releaseSharedRegistryIp(vps.primaryIp);
      }
    } else {
      await releaseSharedRegistryIpByVpsId(vps.id);
    }
  }

  if (vps.primaryIp && params.idempotencyKey) {
    await releaseIpTransactional({
      address: vps.primaryIp,
      idempotencyKey: params.idempotencyKey,
    }).catch(() => {});
  }
}

export async function teardownVpsNetworkResourcesForService(params: {
  serviceId: string;
  destroyVm?: boolean;
  idempotencyKey?: string;
}): Promise<void> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { serviceId: params.serviceId },
    select: { id: true },
  });
  if (!vps) return;
  await teardownVpsNetworkResources({
    vpsId: vps.id,
    destroyVm: params.destroyVm,
    idempotencyKey: params.idempotencyKey,
  });
}
