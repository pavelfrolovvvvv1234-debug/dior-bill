import { prisma } from "@dior/database";
import { releaseIpTransactional } from "../core/inventory/service";
import { getProxmoxNodeName } from "./client";
import {
  releaseSharedRegistryIp,
  releaseSharedRegistryIpByVpsId,
  isSharedIpRegistryEnabled,
} from "./shared-ip-registry";

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
      await releaseSharedRegistryIp(vps.primaryIp);
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
