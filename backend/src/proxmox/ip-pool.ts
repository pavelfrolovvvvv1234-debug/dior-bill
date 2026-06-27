import { prisma } from "@dior/database";
import { syncNodeCapacityFromDb } from "../core/inventory/service";

/** Demo / seed IPs — must never be pushed to Proxmox cloud-init in production. */
export function isPlaceholderIp(address: string): boolean {
  const ip = address.trim();
  return ip.startsWith("185.234.") || /^10\.0\.\d+\.\d+$/.test(ip);
}

export function parseProxmoxIpPool(): string[] {
  const raw = process.env.PROXMOX_IP_POOL?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

export function getProxmoxGateway(): string | undefined {
  return process.env.PROXMOX_GATEWAY?.trim() || undefined;
}

export function getProxmoxIpCidr(): number {
  const raw = process.env.PROXMOX_IP_CIDR?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 24;
  return Number.isFinite(n) && n > 0 && n <= 32 ? n : 24;
}

export function isProxmoxIpPoolConfigured(): boolean {
  return parseProxmoxIpPool().length > 0;
}

/** IPs sold outside web billing (e.g. Telegram bot) — never auto-assign these. */
export function parseProxmoxReservedIps(): string[] {
  const raw = process.env.PROXMOX_RESERVED_IPS?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/**
 * TG bot host octets on the Proxmox /24 (same subnet as PROXMOX_NETWORK).
 * Examples: TELEGRAM_BOT_IP_HOSTS=165-224  or  165,166,170
 */
export function expandTelegramBotHostOctets(subnetPrefix: string): string[] {
  const raw = process.env.TELEGRAM_BOT_IP_HOSTS?.trim();
  if (!raw) return [];
  const ips = new Set<string>();
  for (const part of raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d{1,3})-(\d{1,3})$/);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) continue;
      for (let host = start; host <= end; host++) {
        if (host >= 1 && host <= 254) ips.add(`${subnetPrefix}.${host}`);
      }
      continue;
    }
    const host = Number.parseInt(part, 10);
    if (Number.isFinite(host) && host >= 1 && host <= 254) {
      ips.add(`${subnetPrefix}.${host}`);
    }
  }
  return [...ips];
}

/** Remove demo seed IPs so purchases never get fake 185.234.* addresses. */
export async function purgePlaceholderIpsFromInventory(): Promise<number> {
  const result = await prisma.ipAddress.deleteMany({
    where: {
      status: "available",
      OR: [{ address: { startsWith: "185.234." } }, { address: { startsWith: "10.0." } }],
    },
  });
  return result.count;
}

/**
 * Import routable IPv4s from PROXMOX_IP_POOL into the billing inventory.
 * Removes unused placeholder 185.234.* rows on that node.
 */
export async function syncProxmoxIpPoolFromEnv(): Promise<{
  added: number;
  removed: number;
  poolSize: number;
  nodeHostname: string | null;
}> {
  const pool = parseProxmoxIpPool();
  if (pool.length === 0) {
    return { added: 0, removed: 0, poolSize: 0, nodeHostname: null };
  }

  const locationCode = process.env.PROXMOX_IP_LOCATION?.trim() || "nl-ams";
  const location = await prisma.location.findUnique({ where: { code: locationCode } });
  if (!location) {
    throw new Error(`PROXMOX_IP_LOCATION=${locationCode} not found in database`);
  }

  const node = await prisma.node.findFirst({
    where: { locationId: location.id, status: "online" },
    orderBy: { createdAt: "asc" },
  });
  if (!node) {
    throw new Error(`No online node for location ${locationCode}`);
  }

  const removed = await prisma.ipAddress.deleteMany({
    where: {
      nodeId: node.id,
      status: "available",
      address: { startsWith: "185.234." },
    },
  });

  let added = 0;
  for (const address of pool) {
    const existing = await prisma.ipAddress.findUnique({ where: { address } });
    if (!existing) {
      await prisma.ipAddress.create({
        data: {
          address,
          nodeId: node.id,
          locationId: location.id,
          status: "available",
        },
      });
      added++;
    } else if (existing.nodeId !== node.id || existing.locationId !== location.id) {
      await prisma.ipAddress.update({
        where: { id: existing.id },
        data: { nodeId: node.id, locationId: location.id },
      });
    }
  }

  await syncNodeCapacityFromDb();

  return {
    added,
    removed: removed.count,
    poolSize: pool.length,
    nodeHostname: node.hostname,
  };
}
