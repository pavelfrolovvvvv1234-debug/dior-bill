import type { ProxmoxRuntimeConfig } from "./config";
import { ValidationError } from "@dior/shared";

/** Maps UI / DB `os` values → keys in PROXMOX_TEMPLATE_MAP */
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
  "windows-server-2025": "winserver2019",
  "windows-server-2012": "winserver2019",
  "windows-server-2016": "winserver2019",
  "almalinux-8": "almalinux8",
  "almalinux-9": "almalinux9",
  "rocky-linux": "rockylinux9",
  "rockylinux9": "rockylinux9",
  "rockylinux8": "rockylinux8",
  "centos-9": "rockylinux9",
  "debian-12-cloud": "debian12",
};

/** Legacy fallback — only when PROXMOX_ALLOW_TEMPLATE_FALLBACK=1 */
const LEGACY_FALLBACK_TEMPLATE_VMID = 902;

function allowTemplateFallback(): boolean {
  const v = process.env.PROXMOX_ALLOW_TEMPLATE_FALLBACK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
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
      "PROXMOX_TEMPLATE_MAP is empty. Set a JSON map of OS→template VMID " +
        '(e.g. {"debian12":902}) or PROXMOX_ALLOW_TEMPLATE_FALLBACK=1 for emergency only.',
    );
  }

  const normalized = os.trim().toLowerCase();
  const key =
    OS_TO_MAP_KEY[normalized] ??
    normalized.replace(/[.\-]/g, "").replace("ubuntu", "ubuntu");
  const direct = map[key];
  if (direct) return direct;

  const compact = normalized.replace(/[.\-_]/g, "");
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
    `No Proxmox template mapped for OS "${os}" (looked up key "${key}"). ` +
      `Add it to PROXMOX_TEMPLATE_MAP. Known keys: ${mapKeys.join(", ")}`,
  );
}
