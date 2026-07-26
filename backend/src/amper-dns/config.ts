/** Amper DNS (dns-node) — https://app.amper.network/docs */

export function getAmperDnsApiBaseUrl(): string {
  const raw =
    process.env.AMPER_DNS_API_BASE_URL?.trim() || "https://app.amper.network/api/v1";
  return raw
    .replace(/\/docs\/?$/i, "")
    .replace(/\/$/, "");
}

export function getAmperDnsApiKey(): string {
  const key = process.env.AMPER_DNS_API_KEY?.trim();
  if (!key) {
    throw new Error("AMPER_DNS_API_KEY is not configured");
  }
  return key;
}

export function isAmperDnsConfigured(): boolean {
  return Boolean(process.env.AMPER_DNS_API_KEY?.trim());
}

export function getAmperDnsTimeoutMs(): number {
  const n = Number(process.env.AMPER_DNS_API_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}

/** Fallback NS when Amper DNS create response omits assigned nameservers. */
export function getAmperDnsDefaultNameservers(): string[] {
  const raw = process.env.AMPER_DNS_NAMESERVERS?.trim();
  if (raw) {
    return raw
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean);
  }
  return ["ns1.dior.cloud", "ns2.dior.cloud"];
}
