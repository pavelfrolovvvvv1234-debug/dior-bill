/** ISO country code → display label for Bulletproof VPS region picker */
export const VPS_COUNTRY_LABELS: Record<string, string> = {
  NL: "Netherlands",
  DE: "Germany",
  US: "USA",
  TR: "Turkey",
  FI: "Finland",
  RU: "Russia",
  BY: "Belarus",
  AB: "Abkhazia",
};

/** Standard (non-bulletproof) VPS — Russia, Belarus, Abkhazia only */
export const STANDARD_VPS_COUNTRY_CODES = ["RU", "BY", "AB"] as const;

export type VpsLocationRef = {
  country: string;
  name: string;
  city?: string | null;
};

export function getLocationCountryLabel(loc: VpsLocationRef): string {
  const label = VPS_COUNTRY_LABELS[loc.country?.toUpperCase() ?? ""];
  if (label) return label;
  return loc.name;
}

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
