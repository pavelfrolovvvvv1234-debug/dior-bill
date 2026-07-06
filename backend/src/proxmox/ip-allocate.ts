import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { ValidationError } from "@dior/shared";
import { appendDomainEvent } from "../core/events/store";
import { allocateIpTransactional } from "../core/inventory/service";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import { getProxmoxConfig } from "./config";
import {
  getProxmoxGateway,
  getProxmoxIpCidr,
  isPlaceholderIp,
  isProxmoxIpPoolConfigured,
  parseProxmoxReservedIps,
  expandTelegramBotHostOctets,
  syncProxmoxIpPoolFromEnv,
} from "./ip-pool";
import { resolveTemplateVmid } from "./os-templates";
import { collectTelegramBotIpsFromDatabase } from "./tg-bot-ips";
import {
  getSharedRegistryNetwork,
  isSharedIpRegistryEnabled,
  isSharedIpRegistryRequired,
  listOccupiedSharedRegistryIps,
  reserveBillingIpInSharedRegistry,
} from "./shared-ip-registry";
import { resolveSubnetHostBounds, pickNextFreeInSubnet } from "./shared-ip-registry-logic";

export type ProxmoxNetworkSpec = {
  prefix: string;
  cidr: number;
  gateway: string;
  startHost: number;
  endHost: number;
};

function parseCidrNetwork(raw: string, fallbackCidr: number): { prefix: string; cidr: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) {
    const [addr, bits] = trimmed.split("/");
    const cidr = Number.parseInt(bits, 10);
    if (!Number.isFinite(cidr) || cidr < 8 || cidr > 30) return null;
    const parts = addr.split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map((p) => Number.parseInt(p, 10));
    if (octets.some((o) => !Number.isFinite(o) || o < 0 || o > 255)) return null;
    if (cidr >= 24) {
      return { prefix: octets.slice(0, 3).join("."), cidr };
    }
    return { prefix: octets.slice(0, 3).join("."), cidr };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 4) return null;
  return { prefix: parts.slice(0, 3).join("."), cidr: fallbackCidr };
}

function parseIpconfigNetwork(
  ipconfig0: string,
  gatewayOverride: string | undefined,
  fallbackCidr: number,
): ProxmoxNetworkSpec | null {
  const ipMatch = ipconfig0.match(/ip=([0-9.]+)(?:\/(\d+))?/);
  if (!ipMatch?.[1]) return null;
  const parts = ipMatch[1].split(".");
  if (parts.length !== 4) return null;
  const prefix = parts.slice(0, 3).join(".");
  const cidr = ipMatch[2] ? Number.parseInt(ipMatch[2], 10) : fallbackCidr;
  const gwMatch = ipconfig0.match(/gw=([0-9.]+)/);
  const gateway = gatewayOverride ?? gwMatch?.[1] ?? `${prefix}.1`;
  return {
    prefix,
    cidr: Number.isFinite(cidr) ? cidr : fallbackCidr,
    gateway,
    startHost: 10,
    endHost: 254,
  };
}

function isInSubnet(ip: string, prefix: string): boolean {
  return ip.startsWith(`${prefix}.`);
}

function configHostIp(): string | null {
  const apiUrl = getProxmoxConfig()?.apiUrl;
  if (!apiUrl) return null;
  try {
    const host = new URL(apiUrl).hostname;
    return /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

function hostOctet(ip: string, prefix: string): number | null {
  if (!ip.startsWith(`${prefix}.`)) return null;
  const host = Number.parseInt(ip.split(".")[3] ?? "", 10);
  return Number.isFinite(host) ? host : null;
}

function maxHostOctetInSubnet(used: Set<string>, prefix: string): number {
  let max = 0;
  for (const ip of used) {
    const host = hostOctet(ip, prefix);
    if (host != null && host > max) max = host;
  }
  return max;
}

function allocationFloor(network: ProxmoxNetworkSpec): number {
  const raw = process.env.PROXMOX_IP_START?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 254) return n;
  }
  return network.startHost;
}

/**
 * VMs without ipconfig0/guest-agent still occupy an IP — Proxmox just can't report which one.
 * Block every gap between allocation floor and highest known IP in the subnet.
 */
function applyUndetectedVmGapFill(
  network: ProxmoxNetworkSpec,
  used: Set<string>,
  noIpDetected: number,
): number {
  if (noIpDetected <= 0) return 0;
  if (process.env.PROXMOX_IP_STRICT_GAP_FILL === "0") return 0;

  const floor = network.startHost;
  const maxHost = maxHostOctetInSubnet(used, network.prefix);
  if (maxHost < floor) return 0;

  let filled = 0;
  for (let host = floor; host <= maxHost; host++) {
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (!used.has(candidate)) {
      used.add(candidate);
      filled++;
    }
  }

  if (filled > 0) {
    console.log(
      `[proxmox] strict IP mode: ${noIpDetected} VM(s) without visible IP on Proxmox — ` +
        `blocked ${filled} gap address(es) .${floor}–.${maxHost} (invisible to ipconfig/guest-agent)`,
    );
  }
  return filled;
}

function configuredStartHost(network: ProxmoxNetworkSpec, used: Set<string>): number {
  const floor = allocationFloor(network);
  const maxHost = maxHostOctetInSubnet(used, network.prefix);
  if (maxHost >= floor && maxHost < 254) {
    return Math.max(floor, maxHost + 1);
  }
  return floor;
}

/** Resolve routable subnet for new VMs (env → template → Proxmox host IP). */
export async function resolveProxmoxNetwork(os: string): Promise<ProxmoxNetworkSpec> {
  const config = getProxmoxConfig();
  const fallbackCidr = config?.ipCidr ?? getProxmoxIpCidr();
  const gatewayEnv = config?.gateway ?? getProxmoxGateway();

  const networkEnv = process.env.PROXMOX_NETWORK?.trim();
  const hostBounds = resolveSubnetHostBounds(100, 250);
  if (networkEnv) {
    const parsed = parseCidrNetwork(networkEnv, fallbackCidr);
    if (parsed) {
      return {
        prefix: parsed.prefix,
        cidr: parsed.cidr,
        gateway: gatewayEnv ?? `${parsed.prefix}.1`,
        startHost: hostBounds.startHost,
        endHost: hostBounds.endHost,
      };
    }
  }

  const client = getProxmoxClient();
  if (client && config) {
    const templateVmid = resolveTemplateVmid(os, config);
    try {
      const tplCfg = await client.getVmConfig(config.node, templateVmid);
      const ipconfig0 = tplCfg.ipconfig0 ?? tplCfg.ipconfig1 ?? "";
      const fromTpl = parseIpconfigNetwork(ipconfig0, gatewayEnv, fallbackCidr);
      if (fromTpl) {
        return {
          ...fromTpl,
          startHost: hostBounds.startHost,
          endHost: hostBounds.endHost,
        };
      }
    } catch {
      /* template may not expose ipconfig */
    }
  }

  if (config?.apiUrl) {
    try {
      const host = new URL(config.apiUrl).hostname;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        const prefix = host.split(".").slice(0, 3).join(".");
        return {
          prefix,
          cidr: fallbackCidr,
          gateway: gatewayEnv ?? `${prefix}.1`,
          startHost: hostBounds.startHost,
          endHost: hostBounds.endHost,
        };
      }
    } catch {
      /* ignore */
    }
  }

  throw new ValidationError(
    "Cannot determine Proxmox IP network. Set PROXMOX_IP_POOL or PROXMOX_NETWORK + PROXMOX_GATEWAY in .env",
  );
}

/**
 * Occupied IPv4 set for billing allocation.
 * With PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 → network_ip_allocations is the source of truth.
 */
export async function collectAllUsedProxmoxIps(
  network: ProxmoxNetworkSpec,
  _nodeName?: string,
): Promise<Set<string>> {
  const used = new Set<string>();
  let noIpDetected = 0;

  if (isSharedIpRegistryRequired()) {
    const networkCidr = getSharedRegistryNetwork(network);
    const registry = await listOccupiedSharedRegistryIps(networkCidr);
    for (const ip of registry) used.add(ip);
    used.add(network.gateway);
    return used;
  }

  if (isSharedIpRegistryEnabled()) {
    try {
      const networkCidr = getSharedRegistryNetwork(network);
      const registry = await listOccupiedSharedRegistryIps(networkCidr);
      for (const ip of registry) used.add(ip);
    } catch (err) {
      if (isSharedIpRegistryRequired()) throw err;
      console.warn("[shared-ip] registry unavailable:", err instanceof Error ? err.message : err);
    }
  }

  if (!isSharedIpRegistryRequired()) {
    const client = getProxmoxClient();
    if (client) {
      const scan = await client.collectUsedIpsOnClusterDetailed(network.prefix);
      for (const ip of scan.ips) used.add(ip);
      noIpDetected = scan.noIpDetected;
    }
  }

  for (const ip of parseProxmoxReservedIps()) {
    if (isInSubnet(ip, network.prefix)) used.add(ip);
  }

  for (const ip of expandTelegramBotHostOctets(network.prefix)) {
    used.add(ip);
  }

  for (const ip of await collectTelegramBotIpsFromDatabase()) {
    if (isInSubnet(ip, network.prefix)) used.add(ip);
  }

  const vpsRows = await prisma.vpsInstance.findMany({
    where: { primaryIp: { startsWith: `${network.prefix}.` } },
    select: { primaryIp: true },
  });
  for (const row of vpsRows) {
    if (row.primaryIp && !isPlaceholderIp(row.primaryIp)) used.add(row.primaryIp);
  }

  const ipRows = await prisma.ipAddress.findMany({
    where: {
      address: { startsWith: `${network.prefix}.` },
      status: { in: ["assigned", "reserved"] },
    },
    select: { address: true },
  });
  for (const row of ipRows) {
    if (!isPlaceholderIp(row.address)) used.add(row.address);
  }

  used.add(network.gateway);
  const hostIp = configHostIp();
  if (hostIp && isInSubnet(hostIp, network.prefix)) used.add(hostIp);

  if (!isSharedIpRegistryRequired()) {
    applyUndetectedVmGapFill(network, used, noIpDetected);
  }

  return used;
}

/** Mark IPs already on Proxmox as reserved in billing inventory (pool mode safety). */
export async function reserveProxmoxOccupiedIps(params: {
  locationId: string;
  nodeId?: string;
  used: Set<string>;
}): Promise<number> {
  let reserved = 0;
  for (const address of params.used) {
    if (isPlaceholderIp(address)) continue;
    const row = await prisma.ipAddress.findUnique({ where: { address } });
    if (!row) {
      await prisma.ipAddress.create({
        data: {
          address,
          locationId: params.locationId,
          nodeId: params.nodeId ?? null,
          status: "reserved",
        },
      });
      reserved++;
      continue;
    }
    if (row.status === "available") {
      await prisma.ipAddress.update({
        where: { id: row.id },
        data: { status: "reserved", vpsId: null },
      });
      reserved++;
    }
  }
  return reserved;
}

/** Worker/admin: sync occupancy / next-free (registry-only when PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1). */
export async function syncProxmoxUsedIpsToInventory(
  locationId?: string,
  os = "debian12",
): Promise<{ used: number; reserved: number; nextFree: string | null }> {
  const network = await resolveProxmoxNetwork(os);

  if (isSharedIpRegistryRequired()) {
    const { syncProxmoxClusterToRegistry } = await import("./proxmox-registry-sync");
    const networkCidr = getSharedRegistryNetwork(network);
    const sync = await syncProxmoxClusterToRegistry(network, { quiet: true });
    const occupied = sync.occupied;
    occupied.add(network.gateway);
    const nextFree = pickNextFreeInSubnet(network, occupied);
    return { used: occupied.size, reserved: 0, nextFree };
  }

  const nodeName = getProxmoxNodeName();
  const used = await collectAllUsedProxmoxIps(network, nodeName);

  let locId = locationId;
  let nodeId: string | undefined;
  if (!locId) {
    const locationCode = process.env.PROXMOX_IP_LOCATION?.trim() || "nl-ams";
    const location = await prisma.location.findUnique({ where: { code: locationCode } });
    locId = location?.id;
    if (locId) {
      const node = await prisma.node.findFirst({
        where: { locationId: locId, status: "online" },
        orderBy: { createdAt: "asc" },
      });
      nodeId = node?.id;
    }
  }

  const reserved = locId
    ? await reserveProxmoxOccupiedIps({ locationId: locId, nodeId, used })
    : 0;

  let nextFree: string | null = null;
  for (let host = configuredStartHost(network, used); host <= network.endHost; host++) {
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (!used.has(candidate)) {
      nextFree = candidate;
      break;
    }
  }

  return { used: used.size, reserved, nextFree };
}

function pickNextFreeIp(
  network: ProxmoxNetworkSpec,
  used: Set<string>,
): string | null {
  const floor = configuredStartHost(network, used);
  for (let host = floor; host <= network.endHost; host++) {
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

/** Re-scan Proxmox before cloud-init — catches race with TG bot or parallel provision. */
async function pickVerifiedFreeIp(
  network: ProxmoxNetworkSpec,
  used: Set<string>,
): Promise<string | null> {
  const client = getProxmoxClient();
  const working = new Set(used);

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = pickNextFreeIp(network, working);
    if (!candidate) return null;

    if (client && (await client.isIpInUseOnCluster(candidate, network.prefix))) {
      working.add(candidate);
      continue;
    }

    return candidate;
  }

  return null;
}

/**
 * Allocate a routable IPv4 for Proxmox cloud-init.
 * Skips IPs already used on Proxmox (including TG-bot VMs).
 */
export async function allocateStaticIpForVps(params: {
  locationId: string;
  nodeId?: string;
  vpsId: string;
  os: string;
  idempotencyKey: string;
}): Promise<string> {
  const existing = await prisma.domainEvent.findUnique({
    where: { idempotencyKey: `ip.alloc:${params.idempotencyKey}` },
  });
  if (existing) {
    return (existing.payload as { address: string }).address;
  }

  const nodeRow = params.nodeId
    ? await prisma.node.findUnique({
        where: { id: params.nodeId },
        select: { proxmoxNode: true, name: true },
      })
    : null;
  const nodeName = getProxmoxNodeName(nodeRow?.proxmoxNode ?? nodeRow?.name);
  const network = await resolveProxmoxNetwork(params.os);

  const vpsRow = await prisma.vpsInstance.findUnique({
    where: { id: params.vpsId },
    select: { hostname: true, serviceId: true },
  });

  if (isSharedIpRegistryRequired() && !isSharedIpRegistryEnabled()) {
    throw new ValidationError(
      "PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 — set PROXMOX_NETWORK and run migrate + sync-shared-ip-registry",
    );
  }

  if (isSharedIpRegistryRequired() || isSharedIpRegistryEnabled()) {
    const address = await reserveBillingIpInSharedRegistry({
      network,
      vpsId: params.vpsId,
      serviceId: vpsRow?.serviceId,
      hostname: vpsRow?.hostname,
    });

    await appendDomainEvent({
      eventType: DOMAIN_EVENTS.IP_ALLOCATED,
      aggregateType: "ip",
      aggregateId: params.vpsId,
      payload: {
        address,
        vpsId: params.vpsId,
        nodeId: params.nodeId,
        source: "shared-ip-registry",
        gateway: network.gateway,
      },
      idempotencyKey: `ip.alloc:${params.idempotencyKey}`,
    });

    console.log(`[shared-ip] reserved ${address} for vps ${params.vpsId} (registry-only)`);
    return address;
  }

  const used = await collectAllUsedProxmoxIps(network, nodeName);

  if (isProxmoxIpPoolConfigured()) {
    await syncProxmoxIpPoolFromEnv();
    await reserveProxmoxOccupiedIps({
      locationId: params.locationId,
      nodeId: params.nodeId,
      used,
    });
    const address = await allocateIpTransactional({
      ...params,
      excludeAddresses: used,
    });
    const client = getProxmoxClient();
    if (client && (await client.isIpInUseOnCluster(address, network.prefix))) {
      throw new ValidationError(
        `IPv4 ${address} is already in use on Proxmox (TG bot / another VM)`,
      );
    }
    return address;
  }

  const address = await pickVerifiedFreeIp(network, used);
  if (!address) {
    throw new ValidationError(
      `No free IPv4 in ${network.prefix}.0/${network.cidr} (${used.size} already used on Proxmox/TG bot)`,
    );
  }

  if (used.has(address)) {
    throw new ValidationError(`IPv4 ${address} is already in use on Proxmox`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ipAddress.upsert({
      where: { address },
      create: {
        address,
        locationId: params.locationId,
        nodeId: params.nodeId ?? null,
        status: "assigned",
        vpsId: params.vpsId,
      },
      update: {
        status: "assigned",
        vpsId: params.vpsId,
        locationId: params.locationId,
        nodeId: params.nodeId ?? null,
      },
    });

    if (params.nodeId) {
      await tx.node.updateMany({
        where: { id: params.nodeId },
        data: { activeVps: { increment: 1 } },
      });
    }
  });

  const ipRow = await prisma.ipAddress.findFirst({
    where: { address, vpsId: params.vpsId },
  });

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.IP_ALLOCATED,
    aggregateType: "ip",
    aggregateId: ipRow?.id ?? params.vpsId,
    payload: {
      address,
      vpsId: params.vpsId,
      nodeId: params.nodeId,
      source: "proxmox-auto",
      gateway: network.gateway,
    },
    idempotencyKey: `ip.alloc:${params.idempotencyKey}`,
  });

  console.log(
    `[proxmox] auto-allocated ${address} (gw ${network.gateway}/${network.cidr}, ${used.size} IPs skipped) for vps ${params.vpsId}`,
  );
  return address;
}
