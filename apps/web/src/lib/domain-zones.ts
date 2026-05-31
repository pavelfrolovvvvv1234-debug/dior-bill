export type DomainZone = {
  tld: string;
  priceYear: number;
};

/** Bulletproof offshore registration — annual pricing per zone */
export const BULLETPROOF_DOMAIN_ZONES: readonly DomainZone[] = [
  { tld: "com", priceYear: 80 },
  { tld: "net", priceYear: 80 },
  { tld: "club", priceYear: 80 },
  { tld: "uk", priceYear: 80 },
  { tld: "io", priceYear: 99 },
  { tld: "at", priceYear: 80 },
  { tld: "guru", priceYear: 80 },
  { tld: "info", priceYear: 80 },
  { tld: "app", priceYear: 80 },
  { tld: "bot", priceYear: 80 },
  { tld: "co", priceYear: 80 },
  { tld: "energy", priceYear: 80 },
  { tld: "money", priceYear: 80 },
  { tld: "one", priceYear: 80 },
  { tld: "shop", priceYear: 80 },
  { tld: "skin", priceYear: 80 },
  { tld: "top", priceYear: 80 },
  { tld: "org", priceYear: 80 },
  { tld: "biz", priceYear: 80 },
  { tld: "pro", priceYear: 80 },
  { tld: "cc", priceYear: 80 },
  { tld: "us", priceYear: 80 },
  { tld: "ca", priceYear: 80 },
  { tld: "link", priceYear: 80 },
  { tld: "ac", priceYear: 80 },
  { tld: "bio", priceYear: 80 },
  { tld: "cash", priceYear: 80 },
  { tld: "dev", priceYear: 80 },
  { tld: "host", priceYear: 80 },
  { tld: "my", priceYear: 80 },
  { tld: "pw", priceYear: 80 },
  { tld: "site", priceYear: 80 },
  { tld: "team", priceYear: 80 },
  { tld: "vip", priceYear: 80 },
];

const ZONE_BY_TLD = new Map(BULLETPROOF_DOMAIN_ZONES.map((z) => [z.tld, z]));

/** TLDs checked when the user enters a name without an extension */
export const POPULAR_SEARCH_TLDS = [
  "com",
  "net",
  "org",
  "io",
  "app",
  "co",
  "dev",
  "top",
  "club",
  "info",
  "pro",
  "biz",
  "uk",
  "xyz",
  "at",
  "us",
] as const;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function getDomainZone(tld: string): DomainZone | undefined {
  return ZONE_BY_TLD.get(tld.replace(/^\./, "").toLowerCase());
}

export function parseDomainInput(input: string): { name: string; tld: string; fqdn: string } | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const fqdn = raw.includes(".") ? raw : `${raw}.com`;
  const parts = fqdn.split(".");
  if (parts.length < 2) return null;
  const tld = parts[parts.length - 1];
  const name = parts.slice(0, -1).join(".");
  if (!name || !LABEL_RE.test(name)) return null;
  return { name, tld, fqdn };
}

/** Parse registrar-style search: "mybrand" or "mybrand.com" (also strips www.) */
export function parseDomainSearchInput(
  input: string,
): { label: string; primaryTld?: string; fqdn?: string } | null {
  let raw = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");

  if (raw.startsWith("www.")) raw = raw.slice(4);
  if (!raw) return null;

  if (raw.includes(".")) {
    const parsed = parseDomainInput(raw);
    if (!parsed) return null;
    return { label: parsed.name, primaryTld: parsed.tld, fqdn: parsed.fqdn };
  }

  if (!LABEL_RE.test(raw)) return null;
  return { label: raw };
}

export function buildSearchTldList(primaryTld?: string, limit = 20): string[] {
  const catalog = new Set(BULLETPROOF_DOMAIN_ZONES.map((z) => z.tld));
  const popular = POPULAR_SEARCH_TLDS.filter((tld) => catalog.has(tld));
  const rest = BULLETPROOF_DOMAIN_ZONES.map((z) => z.tld).filter(
    (tld) => !popular.includes(tld as (typeof POPULAR_SEARCH_TLDS)[number]),
  );

  let ordered = [...popular, ...rest];
  if (primaryTld && catalog.has(primaryTld)) {
    ordered = [primaryTld, ...ordered.filter((tld) => tld !== primaryTld)];
  }

  return ordered.slice(0, limit);
}
