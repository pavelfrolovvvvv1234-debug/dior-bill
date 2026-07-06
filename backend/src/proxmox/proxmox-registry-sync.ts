import { prisma } from "@dior/database";
import type { SharedRegistrySubnet } from "./shared-ip-registry-types";
import { getSharedRegistryNetwork } from "./shared-ip-registry";

export type ProxmoxRegistrySyncResult = {
  occupied: Set<string>;
  vmCount: number;
  imported: number;
  reactivated: number;
  vmidsLinked: number;
};

let lastSync: { at: number; networkKey: string; occupied: Set<string> } | null = null;
const SYNC_CACHE_MS = 120_000;

function networkCacheKey(network: SharedRegistrySubnet): string {
  return `${network.prefix}/${network.cidr}`;
}

/**
 * Pull all routable IPs (+ VMID/hostname) from Proxmox into network_ip_allocations.
 * Released rows whose IP is still on a live VM are reactivated so billing never re-assigns them.
 */
export async function syncProxmoxClusterToRegistry(
  network: SharedRegistrySubnet,
  options?: { force?: boolean; quiet?: boolean },
): Promise<ProxmoxRegistrySyncResult> {
  const cacheKey = networkCacheKey(network);
  if (
    !options?.force &&
    lastSync &&
    lastSync.networkKey === cacheKey &&
    Date.now() - lastSync.at < SYNC_CACHE_MS
  ) {
    return {
      occupied: new Set(lastSync.occupied),
      vmCount: 0,
      imported: 0,
      reactivated: 0,
      vmidsLinked: 0,
    };
  }

  const { getProxmoxClient } = await import("./client");
  const client = getProxmoxClient();
  const networkCidr = getSharedRegistryNetwork(network);
  const occupied = new Set<string>();
  occupied.add(network.gateway);

  let imported = 0;
  let reactivated = 0;
  let vmidsLinked = 0;
  let vmCount = 0;

  if (!client) {
    return { occupied, vmCount, imported, reactivated, vmidsLinked };
  }

  const scan = await client.collectUsedIpsOnClusterDetailed(network.prefix);
  for (const ip of scan.ips) occupied.add(ip);

  const inventory = await client.collectClusterVmInventory(network.prefix);
  vmCount = inventory.length;

  const ipToVm = new Map<string, { vmid: number; name: string }>();
  for (const vm of inventory) {
    for (const ip of vm.ips) {
      if (!ip.startsWith(`${network.prefix}.`)) continue;
      if (!ipToVm.has(ip)) ipToVm.set(ip, { vmid: vm.vmid, name: vm.name });
    }
  }

  for (const ip of occupied) {
    if (ip === network.gateway) continue;

    const live = ipToVm.get(ip);
    const row = await prisma.networkIpAllocation.findUnique({ where: { ip } });

    if (!row) {
      await prisma.networkIpAllocation.create({
        data: {
          ip,
          network: networkCidr,
          owner: "manual",
          status: "active",
          vmid: live?.vmid ?? null,
          hostname: live?.name ?? null,
          notes: "sync: live on Proxmox cluster",
        },
      });
      imported++;
      continue;
    }

    if (row.status === "released") {
      await prisma.networkIpAllocation.update({
        where: { ip },
        data: {
          status: "active",
          owner: row.owner === "telegram_bot" ? "telegram_bot" : "manual",
          vmid: live?.vmid ?? row.vmid,
          hostname: live?.name ?? row.hostname,
          releasedAt: null,
          vpsId: row.owner === "billing" ? row.vpsId : null,
          notes: "sync: reactivated — IP still on Proxmox",
        },
      });
      reactivated++;
      continue;
    }

    if (live?.vmid != null && row.vmid !== live.vmid) {
      await prisma.networkIpAllocation.update({
        where: { ip },
        data: {
          vmid: live.vmid,
          hostname: live.name ?? row.hostname,
        },
      });
      vmidsLinked++;
    }
  }

  lastSync = { at: Date.now(), networkKey: cacheKey, occupied: new Set(occupied) };

  if (!options?.quiet && (imported > 0 || reactivated > 0 || vmidsLinked > 0)) {
    console.log(
      `[shared-ip] Proxmox sync: ${occupied.size} IPs, ${vmCount} VMs, ` +
        `+${imported} new, ${reactivated} reactivated, ${vmidsLinked} vmid links`,
    );
  }

  return { occupied, vmCount, imported, reactivated, vmidsLinked };
}

/** Invalidate cache — call before billing IP reserve for a fresh Proxmox snapshot. */
export function invalidateProxmoxRegistrySyncCache(): void {
  lastSync = null;
}
