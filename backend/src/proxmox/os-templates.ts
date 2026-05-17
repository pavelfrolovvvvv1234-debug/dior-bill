import type { ProxmoxRuntimeConfig } from "./config";

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

const FALLBACK_TEMPLATE_VMID = 902;

export function resolveTemplateVmid(
  os: string,
  config: ProxmoxRuntimeConfig,
): number {
  const normalized = os.trim().toLowerCase();
  const key =
    OS_TO_MAP_KEY[normalized] ??
    normalized.replace(/[.\-]/g, "").replace("ubuntu", "ubuntu");
  const direct = config.templateMap[key];
  if (direct) return direct;

  const compact = normalized.replace(/[.\-_]/g, "");
  for (const [mapKey, vmid] of Object.entries(config.templateMap)) {
    if (mapKey.replace(/[.\-_]/g, "") === compact) return vmid;
  }

  const first = Object.values(config.templateMap)[0];
  return first ?? FALLBACK_TEMPLATE_VMID;
}
