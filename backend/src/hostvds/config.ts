/** HostVDS / OpenStack — env + catalog name maps (NOT region UUIDs). */

import { randomBytes } from "crypto";

export type VpsComputeProvider = "proxmox" | "hostvds";

/** Default planId / rateId → flavor NAME (HostVDS Nova). */
export const DEFAULT_HOSTVDS_FLAVOR_MAP: Record<string, string> = {
  "0": "hostvds-1",
  "1": "hostvds-4",
  "2": "hostvds-4",
  "3": "highload-4",
  "4": "highload-8",
  "5": "highload-8",
  "6": "highload-8",
  "7": "highload-16",
  "8": "highload-24",
  "9": "highload-24",
  "std-1": "hostvds-1",
  "std-2": "hostvds-4",
  "std-3": "hostvds-4",
  "std-4": "highload-4",
  "std-5": "highload-8",
  "std-6": "highload-8",
  "std-7": "highload-8",
  "std-8": "highload-16",
  "std-9": "highload-24",
  "std-10": "highload-24",
};

/** Default panel OS slug → Glance image NAME. */
export const DEFAULT_HOSTVDS_IMAGE_MAP: Record<string, string> = {
  ubuntu2404: "Ubuntu-24.04-amd64",
  "ubuntu-24.04": "Ubuntu-24.04-amd64",
  ubuntu2204: "Ubuntu-22.04-amd64",
  "ubuntu-22.04": "Ubuntu-22.04-amd64",
  debian13: "Debian-13-amd64",
  "debian-13": "Debian-13-amd64",
  debian12: "Debian-12-amd64",
  "debian-12": "Debian-12-amd64",
  debian11: "Debian-11-amd64",
  "debian-11": "Debian-11-amd64",
  alma8: "AlmaLinux-8-amd64",
  "almalinux-8": "AlmaLinux-8-amd64",
  alma9: "AlmaLinux-9-amd64",
  "almalinux-9": "AlmaLinux-9-amd64",
  rockylinux: "RockyLinux-9-amd64",
  "rocky-linux": "RockyLinux-9-amd64",
  centos9: "CentOS-9-amd64",
  "centos-9": "CentOS-9-amd64",
};

export function isHostVdsConfigured(): boolean {
  if (process.env.HOSTVDS_API_TOKEN?.trim() && process.env.HOSTVDS_API_BASE_URL?.trim()) {
    return true;
  }
  return Boolean(
    process.env.HOSTVDS_AUTH_URL?.trim() &&
      process.env.HOSTVDS_USERNAME?.trim() &&
      process.env.HOSTVDS_PASSWORD?.trim() &&
      process.env.HOSTVDS_PROJECT_NAME?.trim(),
  );
}

export function getHostVdsTimeoutMs(): number {
  const n = Number(process.env.HOSTVDS_API_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

export function getHostVdsPollIntervalMs(): number {
  const n = Number(process.env.HOSTVDS_POLL_INTERVAL_MS ?? 5_000);
  return Number.isFinite(n) && n > 0 ? n : 5_000;
}

export function getHostVdsProvisionTimeoutMs(): number {
  const n = Number(
    process.env.HOSTVDS_POLL_TIMEOUT_MS ??
      process.env.HOSTVDS_PROVISION_TIMEOUT_MS ??
      600_000,
  );
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

export function getHostVdsSshReadyTimeoutMs(): number {
  const n = Number(process.env.HOSTVDS_SSH_READY_TIMEOUT_MS ?? 180_000);
  return Number.isFinite(n) && n > 0 ? n : 180_000;
}

export function getHostVdsSshSettleMs(): number {
  const n = Number(process.env.HOSTVDS_SSH_SETTLE_MS ?? 15_000);
  return Number.isFinite(n) && n >= 0 ? n : 15_000;
}

export function getHostVdsApiBaseUrl(): string | null {
  const raw = process.env.HOSTVDS_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function getHostVdsApiToken(): string | null {
  return process.env.HOSTVDS_API_TOKEN?.trim() || null;
}

/** Keystone identity URL — must include `/v3`. */
export function getHostVdsAuthUrl(): string | null {
  const raw =
    process.env.HOSTVDS_AUTH_URL?.trim() ||
    process.env.OS_AUTH_URL?.trim() ||
    null;
  if (!raw) return null;
  let url = raw.replace(/\/$/, "");
  if (!/\/v3$/i.test(url)) {
    url = `${url}/v3`;
  }
  return url;
}

/** Network name (preferred) or UUID — resolved via Neutron in active region. */
export function getHostVdsNetworkRef(): string {
  return (
    process.env.HOSTVDS_NETWORK_ID?.trim() ||
    process.env.HOSTVDS_NETWORK_NAME?.trim() ||
    "Internet-03"
  );
}

/** @deprecated use getHostVdsNetworkRef — kept for callers expecting UUID-or-name string */
export function getHostVdsNetworkId(): string | null {
  const ref = getHostVdsNetworkRef();
  return ref || null;
}

export function getHostVdsRegion(): string {
  return (
    process.env.HOSTVDS_REGION_NAME?.trim() ||
    process.env.HOSTVDS_REGION?.trim() ||
    process.env.OS_REGION_NAME?.trim() ||
    "eu-west2"
  );
}

export function getHostVdsSecurityGroups(): string[] {
  const raw = process.env.HOSTVDS_SECURITY_GROUPS?.trim() || "allow_all";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getHostVdsInsecureTls(): boolean {
  return process.env.HOSTVDS_INSECURE_TLS === "1";
}

function parseJsonMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k.trim()] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function getHostVdsImageMap(): Record<string, string> {
  const fromEnv = parseJsonMap(process.env.HOSTVDS_IMAGE_MAP);
  return { ...DEFAULT_HOSTVDS_IMAGE_MAP, ...fromEnv };
}

export function getHostVdsFlavorMap(): Record<string, string> {
  const fromEnv = parseJsonMap(process.env.HOSTVDS_FLAVOR_MAP);
  return { ...DEFAULT_HOSTVDS_FLAVOR_MAP, ...fromEnv };
}

/** Sync: map plan → flavor NAME (not UUID). Throws if unmapped. */
export function resolveHostVdsFlavorName(params: {
  planId?: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
}): string {
  const map = getHostVdsFlavorMap();
  if (params.planId && map[params.planId]) return map[params.planId];
  const specKey = `${params.cpuCores}-${params.ramMb}-${params.diskGb}`;
  if (map[specKey]) return map[specKey];
  throw new Error(
    `HostVDS flavor not mapped for plan=${params.planId ?? "n/a"} spec=${specKey}. Set HOSTVDS_FLAVOR_MAP.`,
  );
}

/** @deprecated use resolveHostVdsFlavorName — returns NAME, not UUID */
export function resolveHostVdsFlavorId(params: {
  planId?: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
}): string {
  return resolveHostVdsFlavorName(params);
}

/** Sync: map OS slug → image NAME. */
export function resolveHostVdsImageName(os: string): string {
  const map = getHostVdsImageMap();
  const key = os.trim().toLowerCase();
  if (map[key]) return map[key];
  const compact = key.replace(/-/g, "");
  if (map[compact]) return map[compact];
  throw new Error(`HostVDS image not mapped for OS "${os}". Set HOSTVDS_IMAGE_MAP.`);
}

/** @deprecated use resolveHostVdsImageName — returns NAME, not UUID */
export function resolveHostVdsImageId(os: string): string {
  return resolveHostVdsImageName(os);
}

export function resolveHostVdsLoginUser(os: string): string {
  if (os.trim().toLowerCase().includes("windows")) return "Administrator";
  return process.env.HOSTVDS_CIUSER?.trim() || "root";
}

export function filterOsOptionsByHostVdsImageMap<T extends { value: string }>(
  options: readonly T[],
): T[] {
  if (!isHostVdsConfigured()) return [];
  const map = getHostVdsImageMap();
  return options.filter((o) => {
    const key = o.value.trim().toLowerCase();
    return Boolean(map[key] || map[key.replace(/-/g, "")]);
  });
}

export function getHostVdsKeystoneConfig(): {
  authUrl: string;
  username: string;
  password: string;
  projectName: string;
  userDomain: string;
  projectDomain: string;
} | null {
  const authUrl = getHostVdsAuthUrl();
  const username =
    process.env.HOSTVDS_USERNAME?.trim() || process.env.OS_USERNAME?.trim();
  const password =
    process.env.HOSTVDS_PASSWORD?.trim() || process.env.OS_PASSWORD?.trim();
  const projectName =
    process.env.HOSTVDS_PROJECT_NAME?.trim() ||
    process.env.OS_PROJECT_NAME?.trim();
  if (!authUrl || !username || !password || !projectName) return null;
  return {
    authUrl,
    username,
    password,
    projectName,
    userDomain:
      process.env.HOSTVDS_USER_DOMAIN_NAME?.trim() ||
      process.env.HOSTVDS_USER_DOMAIN?.trim() ||
      process.env.OS_USER_DOMAIN_NAME?.trim() ||
      "Default",
    projectDomain:
      process.env.HOSTVDS_PROJECT_DOMAIN_NAME?.trim() ||
      process.env.HOSTVDS_PROJECT_DOMAIN?.trim() ||
      process.env.OS_PROJECT_DOMAIN_NAME?.trim() ||
      "Default",
  };
}

/** Alphanumeric password safe for cloud-init YAML (no quotes/specials). */
export function generateHostVdsPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return `A1${out.slice(2)}`;
}
