/** HostVDS OpenStack region → UX location metadata + live catalog sync. */

import { getHostVdsRegion, isHostVdsConfigured } from "./config";
import { hostVdsListComputeRegions } from "./client";

export const HOSTVDS_LOCATION_CODE_PREFIX = "hv-";

/** Best-effort city labels (HostVDS marketing DCs ↔ Keystone region ids). */
export const HOSTVDS_REGION_META: Record<
  string,
  { name: string; country: string; city: string; flag: string; sort: number }
> = {
  "us-west": {
    name: "Silicon Valley",
    country: "US",
    city: "Silicon Valley",
    flag: "🇺🇸",
    sort: 10,
  },
  "us-east": {
    name: "Kansas City",
    country: "US",
    city: "Kansas City",
    flag: "🇺🇸",
    sort: 20,
  },
  "us-east2": {
    name: "Dallas",
    country: "US",
    city: "Dallas",
    flag: "🇺🇸",
    sort: 30,
  },
  "eu-west1": {
    name: "Amsterdam",
    country: "NL",
    city: "Amsterdam",
    flag: "🇳🇱",
    sort: 40,
  },
  "eu-west2": {
    name: "Helsinki",
    country: "FI",
    city: "Helsinki",
    flag: "🇫🇮",
    sort: 50,
  },
  "eu-west3": {
    name: "Paris",
    country: "FR",
    city: "Paris",
    flag: "🇫🇷",
    sort: 60,
  },
  "eu-north1": {
    name: "Helsinki 2",
    country: "FI",
    city: "Helsinki 2",
    flag: "🇫🇮",
    sort: 70,
  },
  "eu-north1b": {
    name: "Helsinki 3",
    country: "FI",
    city: "Helsinki 3",
    flag: "🇫🇮",
    sort: 80,
  },
  "eu-north2": {
    name: "Riga",
    country: "LV",
    city: "Riga",
    flag: "🇱🇻",
    sort: 90,
  },
  "asia-east1": {
    name: "Hong Kong",
    country: "HK",
    city: "Hong Kong",
    flag: "🇭🇰",
    sort: 100,
  },
  "asia-south1": {
    name: "Asia South",
    country: "SG",
    city: "Asia South",
    flag: "🇸🇬",
    sort: 110,
  },
};

export type HostVdsLocationDef = {
  code: string;
  region: string;
  name: string;
  country: string;
  city: string;
  flag: string;
  sort: number;
};

export function hostVdsLocationCode(region: string): string {
  return `${HOSTVDS_LOCATION_CODE_PREFIX}${region.trim()}`;
}

export function hostVdsRegionFromLocationCode(code: string): string | null {
  const c = code.trim();
  if (!c.startsWith(HOSTVDS_LOCATION_CODE_PREFIX)) return null;
  const region = c.slice(HOSTVDS_LOCATION_CODE_PREFIX.length).trim();
  return region || null;
}

export function isHostVdsLocationCode(code: string): boolean {
  return hostVdsRegionFromLocationCode(code) != null;
}

export function getHostVdsRegionMeta(region: string): HostVdsLocationDef {
  const meta = HOSTVDS_REGION_META[region];
  if (meta) {
    return { code: hostVdsLocationCode(region), region, ...meta };
  }
  return {
    code: hostVdsLocationCode(region),
    region,
    name: region,
    country: "XX",
    city: region,
    flag: "🌐",
    sort: 999,
  };
}

/**
 * Comma-separated OpenStack region ids to hide.
 * Defaults hide commonly sold-out DCs on hostvds.com (override with env).
 */
export function getHostVdsDisabledRegions(): Set<string> {
  const raw = process.env.HOSTVDS_DISABLED_REGIONS;
  const source =
    raw !== undefined
      ? raw
      : "us-east2,asia-east1,eu-west1,eu-north2,asia-south1";
  return new Set(
    source
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

let availableCache: { at: number; defs: HostVdsLocationDef[] } | null = null;
const AVAILABLE_TTL_MS = 10 * 60 * 1000;

/**
 * Regions from Keystone compute catalog (minus HOSTVDS_DISABLED_REGIONS).
 * Fast — no per-region flavor probes on page load.
 */
export async function listAvailableHostVdsLocations(
  opts?: { force?: boolean },
): Promise<HostVdsLocationDef[]> {
  if (!isHostVdsConfigured()) return [];

  if (
    !opts?.force &&
    availableCache &&
    Date.now() - availableCache.at < AVAILABLE_TTL_MS
  ) {
    return availableCache.defs;
  }

  const disabled = getHostVdsDisabledRegions();
  let regions: string[];
  try {
    regions = await hostVdsListComputeRegions();
  } catch {
    regions = [getHostVdsRegion()];
  }

  let defs = [...new Set(regions.filter(Boolean))]
    .filter((region) => !disabled.has(region))
    .map((region) => getHostVdsRegionMeta(region));

  if (defs.length === 0) {
    defs = [getHostVdsRegionMeta(getHostVdsRegion())];
  }

  defs.sort((a, b) => a.sort - b.sort || a.region.localeCompare(b.region));
  availableCache = { at: Date.now(), defs };
  return defs;
}

export function clearHostVdsLocationCache(): void {
  availableCache = null;
}
