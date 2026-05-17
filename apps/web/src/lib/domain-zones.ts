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
  if (!name) return null;
  return { name, tld, fqdn };
}
