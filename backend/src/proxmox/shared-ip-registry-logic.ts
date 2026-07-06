import type { SharedRegistrySubnet } from "./shared-ip-registry-types";

export const SHARED_REGISTRY_RESERVE_MAX_ATTEMPTS = 8;

/** Host octet range for billing/bot allocation (env overrides defaults). */
export function resolveSubnetHostBounds(defaultStart = 100, defaultEnd = 250): {
  startHost: number;
  endHost: number;
} {
  const startRaw = process.env.PROXMOX_IP_START?.trim();
  const endRaw = process.env.PROXMOX_IP_END?.trim();
  let startHost = defaultStart;
  let endHost = defaultEnd;

  if (startRaw) {
    const n = Number.parseInt(startRaw, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 254) startHost = n;
  }
  if (endRaw) {
    const n = Number.parseInt(endRaw, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 254) endHost = n;
  }
  if (startHost > endHost) endHost = startHost;
  return { startHost, endHost };
}

export function pickNextFreeInSubnet(
  network: SharedRegistrySubnet,
  occupied: Set<string>,
): string | null {
  for (let host = network.startHost; host <= network.endHost; host++) {
    if (host === 255) continue;
    const candidate = `${network.prefix}.${host}`;
    if (candidate === network.gateway) continue;
    if (candidate.endsWith(".255")) continue;
    if (!occupied.has(candidate)) return candidate;
  }
  return null;
}

export function shouldReuseReleasedRegistryRow(
  row: { status: string } | null | undefined,
): boolean {
  return row?.status === "released";
}
