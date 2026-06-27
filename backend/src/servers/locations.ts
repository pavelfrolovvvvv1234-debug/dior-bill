import { prisma } from "@dior/database";
import { getProxmoxConfig } from "../proxmox/config";
import { isProxmoxIpPoolConfigured, syncProxmoxIpPoolFromEnv } from "../proxmox/ip-pool";

/** Proxmox API node name — use PROXMOX_NODE from .env when set (single cluster). */
function resolveProxmoxNodeForLocation(locCode: string): string {
  const fromEnv = getProxmoxConfig()?.node?.trim();
  if (fromEnv) return fromEnv;
  return `pve-${locCode}`;
}

/** Bulletproof VPS regions — upserted so Elite/Mega plans always have full geo list */
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

/** Standard VPS — Russia, Belarus, Abkhazia */
const STANDARD_VPS_LOCATIONS = [
  {
    code: "ru-msk",
    name: "Russia",
    country: "RU",
    city: "Moscow",
    flag: "🇷🇺",
  },
  {
    code: "by-msq",
    name: "Belarus",
    country: "BY",
    city: "Minsk",
    flag: "🇧🇾",
  },
  {
    code: "ab-suk",
    name: "Abkhazia",
    country: "AB",
    city: "Sukhumi",
    flag: "🇦🇧",
  },
] as const;

let bulletproofEnsured = false;
let standardEnsured = false;

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
  }

  bulletproofEnsured = true;
}

export async function ensureStandardVpsLocations() {
  if (standardEnsured) return;

  for (const loc of STANDARD_VPS_LOCATIONS) {
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

  standardEnsured = true;
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

  const match = node.hostname.match(/node-([a-z]{2}-[a-z]{3})-01/);
  const code = match?.[1] ?? "nl-ams";
  const octet = 10 + Math.abs(hashCode(code)) % 200;
  const ips = Array.from({ length: 32 }, (_, i) => ({
    address: `185.234.${octet}.${i + 10}`,
    nodeId: node.id,
    locationId: node.locationId,
    status: "available" as const,
  }));
  await prisma.ipAddress.createMany({ data: ips, skipDuplicates: true });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
