import { prisma } from "@dior/database";
import { getProxmoxConfig } from "../proxmox/config";
import {
  isProxmoxIpPoolConfigured,
  purgePlaceholderIpsFromInventory,
  syncProxmoxIpPoolFromEnv,
} from "../proxmox/ip-pool";
import { isHostVdsConfigured } from "../hostvds/config";
import {
  HOSTVDS_LOCATION_CODE_PREFIX,
  listAvailableHostVdsLocations,
} from "../hostvds/regions";

/** Proxmox API node name — use PROXMOX_NODE from .env when set (single cluster). */
function resolveProxmoxNodeForLocation(locCode: string): string {
  const fromEnv = getProxmoxConfig()?.node?.trim();
  if (fromEnv) return fromEnv;
  return `pve-${locCode}`;
}

/** Bulletproof VPS — Netherlands, Germany, USA, Turkey */
const BULLETPROOF_VPS_LOCATIONS = [
  {
    code: "nl-ams",
    name: "Netherlands",
    country: "NL",
    city: "Amsterdam",
    flag: "🇳🇱",
  },
  {
    code: "de-fra",
    name: "Germany",
    country: "DE",
    city: "Frankfurt",
    flag: "🇩🇪",
  },
  {
    code: "us-nyc",
    name: "USA",
    country: "US",
    city: "New York",
    flag: "🇺🇸",
  },
  {
    code: "tr-ist",
    name: "Turkey",
    country: "TR",
    city: "Istanbul",
    flag: "🇹🇷",
  },
] as const;

/** Legacy fake regions — deactivated once HostVDS locations are synced. */
const LEGACY_STANDARD_VPS_CODES = ["ru-msk", "by-msq", "ab-suk"] as const;

let bulletproofEnsured = false;
let standardEnsuredAt = 0;
const STANDARD_ENSURE_TTL_MS = 10 * 60 * 1000;

export async function ensureBulletproofVpsLocations() {
  if (bulletproofEnsured) return;

  for (const loc of BULLETPROOF_VPS_LOCATIONS) {
    const location = await prisma.location.upsert({
      where: { code: loc.code },
      update: {
        name: loc.name,
        country: loc.country,
        city: loc.city,
        flag: loc.flag,
        active: true,
      },
      create: {
        code: loc.code,
        name: loc.name,
        country: loc.country,
        city: loc.city,
        flag: loc.flag,
        active: true,
      },
    });

    const node = await prisma.node.upsert({
      where: { hostname: `node-${loc.code}-01` },
      update: {
        locationId: location.id,
        status: "online",
        proxmoxNode: resolveProxmoxNodeForLocation(loc.code),
      },
      create: {
        name: `${loc.name} Node 01`,
        hostname: `node-${loc.code}-01`,
        locationId: location.id,
        type: "compute",
        cpuCores: 64,
        ramGb: 256,
        diskGb: 4000,
        loadPercent: 35,
        activeVps: 0,
        proxmoxNode: resolveProxmoxNodeForLocation(loc.code),
        ipv4Total: 256,
        ipv4Available: 200,
        capacityPercent: 40,
        status: "online",
      },
    });

    await ensureNodeIpPool(node);
  }

  if (isProxmoxIpPoolConfigured()) {
    await syncProxmoxIpPoolFromEnv();
  } else if (process.env.PROXMOX_BASE_URL?.trim() || process.env.PROXMOX_API_URL?.trim()) {
    const removed = await purgePlaceholderIpsFromInventory();
    if (removed > 0) {
      console.log(`[locations] removed ${removed} placeholder demo IPs from inventory`);
    }
  }

  bulletproofEnsured = true;
}

/**
 * Sync Standard VPS locations from live HostVDS Keystone regions
 * (flavors + Internet networks). Replaces legacy RU/BY/AB placeholders.
 */
export async function ensureStandardVpsLocations() {
  if (Date.now() - standardEnsuredAt < STANDARD_ENSURE_TTL_MS) return;

  for (const code of LEGACY_STANDARD_VPS_CODES) {
    await prisma.location.updateMany({
      where: { code },
      data: { active: false },
    });
  }

  if (!isHostVdsConfigured()) {
    await prisma.location.updateMany({
      where: { code: { startsWith: HOSTVDS_LOCATION_CODE_PREFIX } },
      data: { active: false },
    });
    standardEnsuredAt = Date.now();
    return;
  }

  const available = await listAvailableHostVdsLocations();
  const activeCodes = new Set(available.map((l) => l.code));

  for (const loc of available) {
    const location = await prisma.location.upsert({
      where: { code: loc.code },
      update: {
        name: loc.name,
        country: loc.country,
        city: loc.city,
        flag: loc.flag,
        active: true,
      },
      create: {
        code: loc.code,
        name: loc.name,
        country: loc.country,
        city: loc.city,
        flag: loc.flag,
        active: true,
      },
    });

    await prisma.node.upsert({
      where: { hostname: `node-${loc.code}-01` },
      update: {
        locationId: location.id,
        status: "online",
        name: `${loc.city} HostVDS`,
      },
      create: {
        name: `${loc.city} HostVDS`,
        hostname: `node-${loc.code}-01`,
        locationId: location.id,
        type: "compute",
        cpuCores: 64,
        ramGb: 256,
        diskGb: 4000,
        loadPercent: 20,
        activeVps: 0,
        proxmoxNode: null,
        ipv4Total: 0,
        ipv4Available: 0,
        capacityPercent: 20,
        status: "online",
      },
    });
  }

  const stale = await prisma.location.findMany({
    where: {
      code: { startsWith: HOSTVDS_LOCATION_CODE_PREFIX },
      active: true,
    },
    select: { id: true, code: true },
  });
  for (const loc of stale) {
    if (!activeCodes.has(loc.code)) {
      await prisma.location.update({
        where: { id: loc.id },
        data: { active: false },
      });
    }
  }

  standardEnsuredAt = Date.now();
}

/** Seed available IPv4 rows so provisioning can allocate addresses. */
async function ensureNodeIpPool(node: {
  id: string;
  locationId: string;
  hostname: string;
}) {
  if (isProxmoxIpPoolConfigured()) return;

  const existing = await prisma.ipAddress.count({ where: { nodeId: node.id } });
  if (existing > 0) return;

  const suffix = node.hostname.replace(/\D/g, "").slice(-2) || "01";
  const base = `10.${Number(suffix) || 1}.0`;
  const rows = Array.from({ length: 50 }, (_, i) => ({
    address: `${base}.${i + 10}`,
    nodeId: node.id,
    locationId: node.locationId,
    status: "available",
  }));
  await prisma.ipAddress.createMany({ data: rows, skipDuplicates: true });
}
