import type { ProxmoxRuntimeConfig } from "./config";
import { getProxmoxConfig } from "./config";
import { ValidationError } from "@dior/shared";

/**
 * UI / DB `os` value → key inside PROXMOX_TEMPLATE_MAP JSON.
 * Every sellable OS in the panel must have a mapKey listed here AND a VMID in .env.
 */
const OS_TO_MAP_KEY: Record<string, string> = {
  "debian-12": "debian12",
  "debian-13": "debian13",
  "debian-11": "debian11",
  "ubuntu-22.04": "ubuntu2204",
  "ubuntu-24.04": "ubuntu2404",
  "ubuntu-20.04": "ubuntu2004",
  "ubuntu-22": "ubuntu2204",
  "ubuntu-24": "ubuntu2404",
  "windows-server-2019": "winserver2019",
  "windows-server-2025": "winserver2025",
  "windows-server-2012": "winserver2012",
  "windows-server-2016": "winserver2016",
  "windows-10": "windows10",
  "windows-11": "windows11",
  "almalinux-8": "almalinux8",
  "almalinux-9": "almalinux9",
  "rocky-linux": "rockylinux9",
  rockylinux9: "rockylinux9",
  rockylinux8: "rockylinux8",
  "centos-9": "centos9",
  freebsd: "freebsd",
  "debian-12-cloud": "debian12",
};

/** All TEMPLATE_MAP keys the panel may need (for docs / verify script). */
export const ALL_TEMPLATE_MAP_KEYS = [
  "debian11",
  "debian12",
  "debian13",
  "ubuntu2204",
  "ubuntu2404",
  "ubuntu2004",
  "winserver2019",
  "winserver2025",
  "winserver2012",
  "winserver2016",
  "windows10",
  "windows11",
  "almalinux8",
  "almalinux9",
  "rockylinux9",
  "rockylinux8",
  "centos9",
  "freebsd",
] as const;

/** Legacy fallback — only when PROXMOX_ALLOW_TEMPLATE_FALLBACK=1 */
const LEGACY_FALLBACK_TEMPLATE_VMID = 902;

export function allowTemplateFallback(): boolean {
  const v = process.env.PROXMOX_ALLOW_TEMPLATE_FALLBACK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Resolve PROXMOX_TEMPLATE_MAP key for a panel OS slug (e.g. debian-12 → debian12). */
export function osToTemplateMapKey(os: string): string {
  const normalized = os.trim().toLowerCase();
  return (
    OS_TO_MAP_KEY[normalized] ??
    normalized.replace(/[.\-_]/g, "").replace("ubuntu", "ubuntu")
  );
}

export function resolveTemplateVmid(
  os: string,
  config: ProxmoxRuntimeConfig,
): number {
  const map = config.templateMap;
  const mapKeys = Object.keys(map);

  if (mapKeys.length === 0) {
    if (allowTemplateFallback()) {
      console.warn(
        `[proxmox] PROXMOX_TEMPLATE_MAP empty — using legacy fallback template ${LEGACY_FALLBACK_TEMPLATE_VMID}`,
      );
      return LEGACY_FALLBACK_TEMPLATE_VMID;
    }
    throw new ValidationError(
      "PROXMOX_TEMPLATE_MAP is empty. Set a JSON map of OS→template VMID for every OS you sell " +
        '(e.g. {"debian12":902,"ubuntu2404":110}). See .env.example.',
    );
  }

  const key = osToTemplateMapKey(os);
  const direct = map[key];
  if (direct) return direct;

  const compact = os.trim().toLowerCase().replace(/[.\-_]/g, "");
  for (const [mapKey, vmid] of Object.entries(map)) {
    if (mapKey.replace(/[.\-_]/g, "") === compact) return vmid;
  }

  if (allowTemplateFallback()) {
    const first = Object.values(map)[0];
    console.warn(
      `[proxmox] no template for os=${os} (key=${key}) — fallback vmid=${first ?? LEGACY_FALLBACK_TEMPLATE_VMID}`,
    );
    return first ?? LEGACY_FALLBACK_TEMPLATE_VMID;
  }

  throw new ValidationError(
    `OS "${os}" is not sellable: no template in PROXMOX_TEMPLATE_MAP for key "${key}". ` +
      `Configured: ${mapKeys.join(", ") || "(none)"}. Add {"${key}":<vmid>} or remove this OS from the order form.`,
  );
}

/** Fail early at order time if this OS has no Proxmox template. */
export function assertOsHasTemplate(os: string): void {
  const config = getProxmoxConfig();
  if (!config) {
    if (allowTemplateFallback() || process.env.PROXMOX_ALLOW_MOCK_PROVISION === "1") return;
    throw new ValidationError("Proxmox is not configured");
  }
  resolveTemplateVmid(os, config);
}

/**
 * Filter panel OS dropdown to only OSes that have a real template VMID configured.
 * Empty map + fallback → only debian-12 (legacy 902). Empty map without fallback → [].
 */
export function filterOsOptionsByTemplateMap<T extends { value: string }>(
  options: readonly T[],
): T[] {
  const config = getProxmoxConfig();
  if (!config) {
    return options.filter((o) => o.value === "debian-12") as T[];
  }
  const keys = Object.keys(config.templateMap);
  if (keys.length === 0) {
    if (allowTemplateFallback()) {
      return options.filter((o) => o.value === "debian-12") as T[];
    }
    return [];
  }
  return options.filter((o) => {
    const key = osToTemplateMapKey(o.value);
    return typeof config.templateMap[key] === "number" && config.templateMap[key] > 0;
  }) as T[];
}

/** Human-readable coverage report for verify / list scripts. */
export function describeTemplateMapCoverage(): {
  configured: { key: string; vmid: number }[];
  missingRecommended: string[];
} {
  const config = getProxmoxConfig();
  const map = config?.templateMap ?? {};
  const configured = Object.entries(map).map(([key, vmid]) => ({ key, vmid }));
  const missingRecommended = ALL_TEMPLATE_MAP_KEYS.filter((k) => map[k] == null);
  return { configured, missingRecommended: [...missingRecommended] };
}
