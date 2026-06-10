export type DedicatedOsOption = {
  value: string;
  label: string;
};

export const DEFAULT_DEDICATED_OS = "debian-12";

/** OS catalog for standard + bulletproof dedicated servers */
export const DEDICATED_OS_OPTIONS: readonly DedicatedOsOption[] = [
  { value: "ubuntu-24.04", label: "Ubuntu 24.04 LTS" },
  { value: "ubuntu-22.04", label: "Ubuntu 22.04 LTS" },
  { value: "ubuntu-20.04", label: "Ubuntu 20.04 LTS" },
  { value: "debian-13", label: "Debian 13" },
  { value: "debian-12", label: "Debian 12" },
  { value: "debian-11", label: "Debian 11" },
  { value: "almalinux-9", label: "AlmaLinux 9" },
  { value: "almalinux-8", label: "AlmaLinux 8" },
  { value: "rocky-9", label: "Rocky Linux 9" },
  { value: "rocky-8", label: "Rocky Linux 8" },
  { value: "centos-stream-9", label: "CentOS Stream 9" },
  { value: "centos-stream-8", label: "CentOS Stream 8" },
  { value: "oracle-linux-9", label: "Oracle Linux 9" },
  { value: "fedora-latest", label: "Fedora (latest)" },
  { value: "windows-server-2022", label: "Windows Server 2022" },
  { value: "windows-server-2019", label: "Windows Server 2019" },
  { value: "windows-server-2016", label: "Windows Server 2016" },
  { value: "windows-server-2012-r2", label: "Windows Server 2012 R2" },
  { value: "windows-10-pro", label: "Windows 10 Pro" },
  { value: "windows-11-pro", label: "Windows 11 Pro" },
];

export function getDedicatedOsLabel(value: string): string {
  return DEDICATED_OS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
