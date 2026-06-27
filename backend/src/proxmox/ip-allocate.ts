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
  syncProxmoxIpPoolFromEnv,
} from "./ip-pool";
import { resolveTemplateVmid } from "./os-templates";

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

function configuredStartHost(fallback: number): number {
  const raw = process.env.PROXMOX_IP_START?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 2 && n <= 254 ? n : fallback;
}

/** Resolve routable subnet for new VMs (env → template → Proxmox host IP). */
export async function resolveProxmoxNetwork(os: string): Promise<ProxmoxNetworkSpec> {
  const config = getProxmoxConfig();
  const fallbackCidr = config?.ipCidr ?? getProxmoxIpCidr();
  const gatewayEnv = config?.gateway ?? getProxmoxGateway();

  const networkEnv = process.env.PROXMOX_NETWORK?.trim();
  if (networkEnv) {
    const parsed = parseCidrNetwork(networkEnv, fallbackCidr);
    if (parsed) {
      return {
        prefix: parsed.prefix,
        cidr: parsed.cidr,
        gateway: gatewayEnv ?? `${parsed.prefix}.1`,
        startHost: 10,
        endHost: 254,
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
      if (fromTpl) return fromTpl;
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
          startHost: 10,
          endHost: 254,
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
 * Every IPv4 that must not be assigned by web billing:
 * - PROXMOX_RESERVED_IPS (TG bot / manual)
 * - billing DB (web sales)
 * - live Proxmox VMs (TG bot + web, via ipconfig0 and guest-agent)
 */
export async function collectAllUsedProxmoxIps(
  network: ProxmoxNetworkSpec,
  nodeName: string,
): Promise<Set<string>> {
  const used = new Set<string>();

  for (const ip of parseProxmoxReservedIps()) {
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

  const client = getProxmoxClient();
  if (client) {
    const live = await client.collectUsedIpsOnNode(nodeName, network.prefix);
    for (const ip of live) used.add(ip);
  }

  used.add(network.gateway);
  const hostIp = configHostIp();
  if (hostIp && isInSubnet(hostIp, network.prefix)) used.add(hostIp);

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

/** Worker/admin: sync live Proxmox occupancy into inventory. */
export async function syncProxmoxUsedIpsToInventory(
  locationId?: string,
  os = "debian12",
): Promise<{ used: number; reserved: number; nextFree: string | null }> {
  const network = await resolveProxmoxNetwork(os);
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
  for (let host = configuredStartHost(network.startHost); host <= network.endHost; host++) {
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
  const floor = configuredStartHost(network.startHost);
  for (let host = floor; host <= network.endHost; host++) {
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (!used.has(candidate)) return candidate;
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
  const used = await collectAllUsedProxmoxIps(network, nodeName);

  if (isProxmoxIpPoolConfigured()) {
    await syncProxmoxIpPoolFromEnv();
    await reserveProxmoxOccupiedIps({
      locationId: params.locationId,
      nodeId: params.nodeId,
      used,
    });
    return allocateIpTransactional({
      ...params,
      excludeAddresses: used,
    });
  }

  const address = pickNextFreeIp(network, used);
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
