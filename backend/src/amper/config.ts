/** Normalize AMPER_API_BASE_URL (docs URL → API root) */
export function getAmperApiBaseUrl(): string {
  const raw = process.env.AMPER_API_BASE_URL?.trim() || "https://amper.lat/api/v1";
  return raw
    .replace(/\/docs\/?$/i, "")
    .replace(/\/$/, "");
}

export function getAmperApiToken(): string {
  const token = process.env.AMPER_API_TOKEN?.trim();
  if (!token) {
    throw new Error("AMPER_API_TOKEN is not configured");
  }
  return token;
}

export function getAmperTimeoutMs(): number {
  const n = Number(process.env.AMPER_API_TIMEOUT_MS ?? 8000);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

export function isAmperConfigured(): boolean {
  return Boolean(process.env.AMPER_API_TOKEN?.trim());
}

export function buildAmperAuthHeader(token: string): string {
  const t = token.trim();
  if (t.startsWith("ApiKey ") || t.startsWith("Bearer ")) return t;
  if (t.startsWith("sk_")) return `ApiKey ${t}`;
  return `ApiKey ${t}`;
}
