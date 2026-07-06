import { prisma } from "@dior/database";
import { ValidationError } from "@dior/shared";
import {
  pickNextFreeInSubnet,
  resolveSubnetHostBounds,
  SHARED_REGISTRY_RESERVE_MAX_ATTEMPTS,
  shouldReuseReleasedRegistryRow,
} from "./shared-ip-registry-logic";
import type { SharedRegistrySubnet } from "./shared-ip-registry-types";

export type { SharedRegistrySubnet } from "./shared-ip-registry-types";
export {
  pickNextFreeInSubnet,
  resolveSubnetHostBounds,
  SHARED_REGISTRY_RESERVE_MAX_ATTEMPTS,
  shouldReuseReleasedRegistryRow,
} from "./shared-ip-registry-logic";

const OCCUPIED_STATUSES = ["reserved", "active"] as const;

export function isSharedIpRegistryEnabled(): boolean {
  if (process.env.SHARED_IP_REGISTRY === "1") return true;
  if (process.env.PROXMOX_REQUIRE_SHARED_IP_REGISTRY === "1") return true;
  if (process.env.SHARED_IP_DATABASE_URL?.trim()) return true;
  return false;
}

export function isSharedIpRegistryRequired(): boolean {
  return process.env.PROXMOX_REQUIRE_SHARED_IP_REGISTRY === "1";
}

/** CIDR string shared with TG bot (e.g. 45.74.7.0/24). */
export function getSharedRegistryNetwork(network?: SharedRegistrySubnet): string {
  const fromEnv = process.env.PROXMOX_NETWORK?.trim() || process.env.SHARED_IP_NETWORK?.trim();
  if (fromEnv) return fromEnv;
  if (network) return `${network.prefix}.0/${network.cidr}`;
  throw new ValidationError("Set PROXMOX_NETWORK (e.g. 45.74.7.0/24) for shared IP registry");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function listOccupiedSharedRegistryIps(networkCidr: string): Promise<Set<string>> {
  const rows = await prisma.networkIpAllocation.findMany({
    where: {
      network: networkCidr,
      status: { in: [...OCCUPIED_STATUSES] },
    },
    select: { ip: true },
  });
  return new Set(rows.map((r) => r.ip));
}

/** Next free IPv4 from registry occupied set only (no Proxmox scan). */
export async function pickNextFreeFromSharedRegistry(
  network: SharedRegistrySubnet,
): Promise<string | null> {
  const networkCidr = getSharedRegistryNetwork(network);
  const occupied = await listOccupiedSharedRegistryIps(networkCidr);
  occupied.add(network.gateway);
  return pickNextFreeInSubnet(network, occupied);
}

async function collectOccupiedForReserve(
  tx: {
    $queryRaw: typeof prisma.$queryRaw;
    networkIpAllocation: typeof prisma.networkIpAllocation;
  },
  networkCidr: string,
  network: SharedRegistrySubnet,
): Promise<Set<string>> {
  const locked = await tx.$queryRaw<Array<{ ip: string }>>`
    SELECT ip FROM network_ip_allocations
    WHERE network = ${networkCidr} AND status IN ('reserved', 'active')
    FOR UPDATE
  `;
  const occupied = new Set(locked.map((r) => r.ip));
  occupied.add(network.gateway);

  const scanFallback =
    !isSharedIpRegistryRequired() && process.env.SHARED_IP_PROXMOX_SCAN_FALLBACK !== "0";
  if (scanFallback) {
    const { getProxmoxClient } = await import("./client");
    const client = getProxmoxClient();
    if (client) {
      try {
        const scan = await client.collectUsedIpsOnClusterDetailed(network.prefix);
        for (const ip of scan.ips) occupied.add(ip);
      } catch {
        /* Proxmox offline — registry rows are still authoritative */
      }
    }
  }

  return occupied;
}

/**
 * Reserve IPv4 in shared registry before Proxmox create (owner=billing, status=reserved).
 * UNIQUE(ip) prevents race with TG bot.
 */
export async function reserveBillingIpInSharedRegistry(params: {
  network: SharedRegistrySubnet;
  vpsId: string;
  serviceId?: string;
  hostname?: string;
}): Promise<string> {
  const networkCidr = getSharedRegistryNetwork(params.network);

  const existing = await prisma.networkIpAllocation.findFirst({
    where: {
      vpsId: params.vpsId,
      owner: "billing",
      status: { in: [...OCCUPIED_STATUSES] },
    },
  });
  if (existing) return existing.ip;

  return prisma.$transaction(
    async (tx) => {
      const occupied = await collectOccupiedForReserve(tx, networkCidr, params.network);

      for (let attempt = 0; attempt < SHARED_REGISTRY_RESERVE_MAX_ATTEMPTS; attempt++) {
        const candidate = pickNextFreeInSubnet(params.network, occupied);
        if (!candidate) {
          throw new ValidationError(
            `No free IPv4 in shared registry for ${networkCidr} (${occupied.size} occupied). Run: pnpm run sync-shared-ip-registry`,
          );
        }

        try {
          const prior = await tx.networkIpAllocation.findUnique({ where: { ip: candidate } });
          if (shouldReuseReleasedRegistryRow(prior)) {
            await tx.networkIpAllocation.update({
              where: { ip: candidate },
              data: {
                network: networkCidr,
                owner: "billing",
                status: "reserved",
                vpsId: params.vpsId,
                externalServiceId: params.serviceId ?? null,
                hostname: params.hostname ?? null,
                vmid: null,
                releasedAt: null,
              },
            });
            console.log(`[shared-ip] re-reserved ${candidate} for billing vps ${params.vpsId}`);
            return candidate;
          }

          await tx.networkIpAllocation.create({
            data: {
              ip: candidate,
              network: networkCidr,
              owner: "billing",
              status: "reserved",
              vpsId: params.vpsId,
              externalServiceId: params.serviceId ?? null,
              hostname: params.hostname ?? null,
            },
          });
          console.log(`[shared-ip] reserved ${candidate} for billing vps ${params.vpsId}`);
          return candidate;
        } catch (err) {
          if (isUniqueViolation(err)) {
            occupied.add(candidate);
            continue;
          }
          throw err;
        }
      }

      throw new ValidationError("Could not reserve IPv4 in shared registry (concurrent conflict)");
    },
    { timeout: 15_000 },
  );
}

export async function activateSharedRegistryIp(params: {
  ip: string;
  vmid: number;
  vpsId?: string;
  hostname?: string;
}): Promise<void> {
  const result = await prisma.networkIpAllocation.updateMany({
    where: {
      ip: params.ip,
      owner: "billing",
      status: { in: [...OCCUPIED_STATUSES] },
    },
    data: {
      status: "active",
      vmid: params.vmid,
      vpsId: params.vpsId ?? undefined,
      hostname: params.hostname ?? undefined,
    },
  });
  if (result.count === 0) {
    console.warn(`[shared-ip] activate skipped — no billing row for ${params.ip}`);
  }
}

export async function releaseSharedRegistryIp(ip: string): Promise<void> {
  const result = await prisma.networkIpAllocation.updateMany({
    where: {
      ip,
      status: { in: [...OCCUPIED_STATUSES] },
    },
    data: {
      status: "released",
      releasedAt: new Date(),
      vmid: null,
      vpsId: null,
      externalServiceId: null,
    },
  });
  if (result.count > 0) {
    console.log(`[shared-ip] released ${ip}`);
  }
}

export async function releaseSharedRegistryIpByVpsId(vpsId: string): Promise<void> {
  const result = await prisma.networkIpAllocation.updateMany({
    where: {
      vpsId,
      status: { in: [...OCCUPIED_STATUSES] },
    },
    data: {
      status: "released",
      releasedAt: new Date(),
      vmid: null,
      vpsId: null,
      externalServiceId: null,
    },
  });
  if (result.count > 0) {
    console.log(`[shared-ip] released registry row(s) for vps ${vpsId}`);
  }
}

export async function releaseSharedRegistryIpByVmid(vmid: number): Promise<void> {
  const result = await prisma.networkIpAllocation.updateMany({
    where: {
      vmid,
      status: { in: [...OCCUPIED_STATUSES] },
    },
    data: {
      status: "released",
      releasedAt: new Date(),
      vmid: null,
      vpsId: null,
      externalServiceId: null,
    },
  });
  if (result.count > 0) {
    console.log(`[shared-ip] released registry row(s) for vmid ${vmid}`);
  }
}

/** Stale billing reserves (kill -9 after reserve, crashed worker). */
export async function releaseStaleSharedRegistryReservations(): Promise<number> {
  const ttlMin = Number.parseInt(process.env.SHARED_IP_RESERVE_TTL_MINUTES ?? "30", 10);
  const ttlMs = (Number.isFinite(ttlMin) && ttlMin > 0 ? ttlMin : 30) * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs);

  const result = await prisma.networkIpAllocation.updateMany({
    where: {
      status: "reserved",
      owner: "billing",
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "released",
      releasedAt: new Date(),
      vmid: null,
      vpsId: null,
      externalServiceId: null,
    },
  });

  if (result.count > 0) {
    console.log(`[shared-ip] released ${result.count} stale reserved IP(s) older than ${ttlMin}m`);
  }
  return result.count;
}

async function listLiveClusterVmids(): Promise<Set<number>> {
  const { getProxmoxClient } = await import("./client");
  const client = getProxmoxClient();
  const vmids = new Set<number>();
  if (!client) return vmids;

  let nodes: Array<{ node: string; status: string }>;
  try {
    nodes = await client.listNodes();
  } catch {
    return vmids;
  }

  for (const { node } of nodes) {
    try {
      const vms = await client.listVms(node);
      for (const vm of vms) {
        if (vm.template !== 1) vmids.add(vm.vmid);
      }
    } catch {
      /* node offline */
    }
  }
  return vmids;
}

/**
 * Daily reconcile: drop billing rows whose VMID vanished from Proxmox; import new IPs from scan.
 */
export async function reconcileSharedRegistryWithProxmox(
  os = "debian12",
  options?: { force?: boolean },
): Promise<{
  staleReserved: number;
  releasedGhost: number;
  imported: number;
  skipped: number;
  findings: string[];
}> {
  const findings: string[] = [];
  if (!isSharedIpRegistryEnabled() && !options?.force) {
    return { staleReserved: 0, releasedGhost: 0, imported: 0, skipped: 0, findings };
  }

  const { resolveProxmoxNetwork } = await import("./ip-allocate");
  const network = await resolveProxmoxNetwork(os);
  const networkCidr = getSharedRegistryNetwork(network);

  const staleReserved = await releaseStaleSharedRegistryReservations();

  const liveVmids = await listLiveClusterVmids();
  let releasedGhost = 0;

  const billingRows = await prisma.networkIpAllocation.findMany({
    where: {
      owner: "billing",
      status: { in: [...OCCUPIED_STATUSES] },
      network: networkCidr,
    },
  });

  for (const row of billingRows) {
    if (row.vmid != null && !liveVmids.has(row.vmid)) {
      await prisma.networkIpAllocation.update({
        where: { id: row.id },
        data: {
          status: "released",
          releasedAt: new Date(),
          vmid: null,
          vpsId: null,
          externalServiceId: null,
          notes: row.notes ?? "reconcile: VMID missing on Proxmox",
        },
      });
      releasedGhost++;
      findings.push(`Released ${row.ip} — vmid ${row.vmid} not on Proxmox`);
    }
  }

  const { getProxmoxClient } = await import("./client");
  const client = getProxmoxClient();
  const used = new Set<string>();
  if (client) {
    const scan = await client.collectUsedIpsOnClusterDetailed(network.prefix);
    for (const ip of scan.ips) used.add(ip);
  }

  const sync = await syncSharedRegistryFromProxmox({ network, ips: used });

  return {
    staleReserved,
    releasedGhost,
    imported: sync.inserted,
    skipped: sync.skipped,
    findings,
  };
}

/** Seed registry from Proxmox scan + billing DB (one-time / periodic). */
export async function syncSharedRegistryFromProxmox(params: {
  network: SharedRegistrySubnet;
  ips: Set<string>;
  dryRun?: boolean;
}): Promise<{ inserted: number; skipped: number }> {
  const networkCidr = getSharedRegistryNetwork(params.network);
  let inserted = 0;
  let skipped = 0;

  for (const ip of params.ips) {
    if (ip === params.network.gateway) continue;
    const row = await prisma.networkIpAllocation.findUnique({ where: { ip } });
    if (row) {
      skipped++;
      continue;
    }
    if (params.dryRun) {
      console.log(`[dry-run] would insert ${ip} owner=manual status=active`);
      inserted++;
      continue;
    }
    await prisma.networkIpAllocation.create({
      data: {
        ip,
        network: networkCidr,
        owner: "manual",
        status: "active",
        notes: "sync from Proxmox/billing scan",
      },
    });
    inserted++;
  }

  return { inserted, skipped };
}
