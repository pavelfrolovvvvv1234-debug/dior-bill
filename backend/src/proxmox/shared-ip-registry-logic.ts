import type { SharedRegistrySubnet } from "./shared-ip-registry-types";

function allocationFloor(network: SharedRegistrySubnet): number {
  const raw = process.env.PROXMOX_IP_START?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 254) return n;
  }
  return network.startHost;
}

export function pickNextFreeInSubnet(
  network: SharedRegistrySubnet,
  occupied: Set<string>,
): string | null {
  for (let host = allocationFloor(network); host <= network.endHost; host++) {
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (!occupied.has(candidate)) return candidate;
  }
  return null;
}

export function shouldReuseReleasedRegistryRow(
  row: { status: string } | null | undefined,
): boolean {
  return row?.status === "released";
}
