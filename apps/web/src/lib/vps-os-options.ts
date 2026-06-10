export type VpsOsOption = {
  value: string;
  label: string;
};

export const DEFAULT_VPS_OS = "debian-12";

/** Default Linux images for TurboVDS and legacy deploy flows */
export const STANDARD_VPS_OS_OPTIONS: readonly VpsOsOption[] = [
  { value: "debian-12", label: "Debian 12" },
  { value: "ubuntu-22.04", label: "Ubuntu 22.04" },
  { value: "ubuntu-24.04", label: "Ubuntu 24.04" },
];

/** Full catalog for Bulletproof VPS/VDS */
export const BULLETPROOF_VPS_OS_OPTIONS: readonly VpsOsOption[] = [
  { value: "windows-server-2019", label: "Windows Server 2019" },
  { value: "windows-server-2025", label: "Windows Server 2025" },
  { value: "windows-server-2012", label: "Windows Server 2012" },
  { value: "windows-server-2016", label: "Windows Server 2016" },
  { value: "windows-10", label: "Windows 10" },
  { value: "windows-11", label: "Windows 11" },
  { value: "almalinux-8", label: "AlmaLinux 8" },
  { value: "almalinux-9", label: "AlmaLinux 9" },
  { value: "rocky-linux", label: "Rocky Linux" },
  { value: "centos-9", label: "CentOS 9" },
  { value: "debian-11", label: "Debian 11" },
  { value: "debian-12", label: "Debian 12" },
  { value: "debian-13", label: "Debian 13" },
  { value: "freebsd", label: "FreeBSD" },
  { value: "ubuntu-22.04", label: "Ubuntu 22.04" },
  { value: "ubuntu-24.04", label: "Ubuntu 24.04" },
];

export function getVpsOsLabel(
  value: string,
  options: readonly VpsOsOption[] = BULLETPROOF_VPS_OS_OPTIONS,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
