/** ISO country code → display label for Bulletproof VPS region picker */
export const VPS_COUNTRY_LABELS: Record<string, string> = {
  NL: "Netherlands",
  DE: "Germany",
  US: "USA",
  TR: "Turkey",
  FI: "Finland",
  FR: "France",
  HK: "Hong Kong",
  LV: "Latvia",
  SG: "Singapore",
  RU: "Russia",
  BY: "Belarus",
  AB: "Abkhazia",
};

/** HostVDS location codes are `hv-{openstack-region}` */
export const HOSTVDS_LOCATION_CODE_PREFIX = "hv-";

/** Standard (non-bulletproof) VPS — HostVDS OpenStack regions */
export const STANDARD_VPS_COUNTRY_CODES = [
  "US",
  "NL",
  "FI",
  "FR",
  "HK",
  "LV",
  "SG",
] as const;

/** Bulletproof offshore VPS / dedicated — Netherlands, Germany, USA, Turkey */
export const BULLETPROOF_OFFSHORE_COUNTRY_CODES = ["NL", "DE", "US", "TR"] as const;

export type VpsLocationRef = {
  code?: string;
  country: string;
  name: string;
  city?: string | null;
};

export function isHostVdsLocationCode(code: string): boolean {
  return code.trim().startsWith(HOSTVDS_LOCATION_CODE_PREFIX);
}

export function getLocationCountryLabel(loc: VpsLocationRef): string {
  const label = VPS_COUNTRY_LABELS[loc.country?.toUpperCase() ?? ""];
  if (label) return label;
  return loc.name;
}

/** Region line in order form — country only (bulletproof); city for HostVDS */
export function getLocationRegionLabel(loc: VpsLocationRef): string {
  if (loc.code && isHostVdsLocationCode(loc.code)) {
    return loc.city?.trim() || loc.name || getLocationCountryLabel(loc);
  }
  return getLocationCountryLabel(loc);
}

/**
 * Fallback HostVDS locations when DB sync has not run yet.
 * Codes must match backend `hostVdsLocationCode(region)`.
 */
export const STANDARD_VPS_LOCATION_DEFS = [
  { code: "hv-us-west", name: "Silicon Valley", country: "US", city: "Silicon Valley" },
  { code: "hv-us-east", name: "Kansas City", country: "US", city: "Kansas City" },
  { code: "hv-us-east2", name: "Dallas", country: "US", city: "Dallas" },
  { code: "hv-eu-west1", name: "Amsterdam", country: "NL", city: "Amsterdam" },
  { code: "hv-eu-west2", name: "Helsinki", country: "FI", city: "Helsinki" },
  { code: "hv-eu-west3", name: "Paris", country: "FR", city: "Paris" },
  { code: "hv-eu-north1", name: "Helsinki 2", country: "FI", city: "Helsinki 2" },
  { code: "hv-eu-north1b", name: "Helsinki 3", country: "FI", city: "Helsinki 3" },
  { code: "hv-eu-north2", name: "Riga", country: "LV", city: "Riga" },
  { code: "hv-asia-east1", name: "Hong Kong", country: "HK", city: "Hong Kong" },
] as const;

/** Fallback for bulletproof offshore (NL, DE, US, TR) */
export const BULLETPROOF_OFFSHORE_LOCATION_DEFS = [
  { code: "nl-ams", name: "Netherlands", country: "NL", city: "Amsterdam" },
  { code: "de-fra", name: "Germany", country: "DE", city: "Frankfurt" },
  { code: "us-nyc", name: "USA", country: "US", city: "New York" },
  { code: "tr-ist", name: "Turkey", country: "TR", city: "Istanbul" },
] as const;

/** Location codes available per Bulletproof VPS tier */
export const BP_VPS_LITE_LOCATION_CODES = ["nl-ams"] as const;
export const BP_VPS_ELITE_LOCATION_CODES = [
  "nl-ams",
  "de-fra",
  "us-nyc",
  "tr-ist",
] as const;

const LITE_PLAN_IDS = new Set(["lite1", "lite2", "lite3"]);
const ELITE_PLUS_PLAN_IDS = new Set([
  "elite1",
  "elite2",
  "elite3",
  "mega1",
  "mega2",
  "mega3",
  "mega4",
]);

export function getBulletproofVpsLocationCodes(planId: string): readonly string[] | null {
  if (LITE_PLAN_IDS.has(planId)) return BP_VPS_LITE_LOCATION_CODES;
  if (ELITE_PLUS_PLAN_IDS.has(planId)) return BP_VPS_ELITE_LOCATION_CODES;
  return null;
}

export function isBulletproofVpsPlan(planId: string): boolean {
  return getBulletproofVpsLocationCodes(planId) !== null;
}

export function isLocationAllowedForBulletproofPlan(planId: string, locationCode: string): boolean {
  const allowed = getBulletproofVpsLocationCodes(planId);
  if (!allowed) return true;
  return (allowed as readonly string[]).includes(locationCode);
}

export function filterLocationsForBulletproofPlan<T extends { code: string }>(
  locations: readonly T[],
  planId: string,
  enabled: boolean,
): T[] {
  if (!enabled) return [...locations];
  const allowed = getBulletproofVpsLocationCodes(planId);
  if (!allowed) return [...locations];
  const codes = new Set<string>(allowed);
  return locations.filter((loc) => codes.has(loc.code));
}

export function filterLocationsByCountryCodes<T extends { country: string }>(
  locations: readonly T[],
  countryCodes: readonly string[],
): T[] {
  const allowed = new Set(countryCodes.map((c) => c.toUpperCase()));
  return locations.filter((loc) => allowed.has(loc.country?.toUpperCase() ?? ""));
}

export function filterHostVdsLocations<T extends { code: string }>(locations: readonly T[]): T[] {
  return locations.filter((loc) => isHostVdsLocationCode(loc.code));
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function citySlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Region line in order form with locale-aware label */
export function getTranslatedLocationRegionLabel(
  loc: VpsLocationRef,
  t: TranslateFn,
): string {
  if (loc.code && isHostVdsLocationCode(loc.code)) {
    const city = loc.city?.trim() || loc.name;
    if (city) {
      const key = `locations.cities.${citySlug(city)}`;
      const translated = t(key);
      return translated !== key ? translated : city;
    }
  }
  const cc = loc.country?.toUpperCase() ?? "";
  const countryKey = `locations.countries.${cc}`;
  const translatedCountry = t(countryKey);
  return translatedCountry !== countryKey ? translatedCountry : getLocationCountryLabel(loc);
}
