import { getProxmoxClient } from "./client";

/** Working TG-bot VM on cluster (master-serv01) — mirror hardware/network model from it. */
export function getReferenceVmid(): number {
  const raw = process.env.PROXMOX_REFERENCE_VMID?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 208;
  return Number.isFinite(n) && n > 100 ? n : 208;
}

export async function loadReferenceVmConfig(
  node: string,
): Promise<Record<string, string> | null> {
  const client = getProxmoxClient();
  if (!client) return null;
  const refVmid = getReferenceVmid();
  try {
    const cfg = await client.getVmConfig(node, refVmid);
    console.log(`[proxmox] reference profile from vmid ${refVmid} (${cfg.name ?? "?"})`);
    return cfg;
  } catch (e) {
    console.warn(
      `[proxmox] reference vmid ${refVmid} unavailable:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Parse net0=virtio=AA:BB:...,bridge=vmbr0,tag=100,firewall=1 */
export function parseNet0(net0: string | undefined): {
  model: string;
  mac: string | null;
  bridge: string | null;
  tag: string | null;
  mtu: string | null;
} {
  if (!net0) {
    return { model: "virtio", mac: null, bridge: null, tag: null, mtu: null };
  }
  const model =
    net0.match(/^(virtio|e1000|rtl8139|vmxnet3)/i)?.[1]?.toLowerCase() ?? "virtio";
  const mac = net0.match(/=([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})/)?.[1] ?? null;
  const bridge = net0.match(/bridge=([^,]+)/)?.[1] ?? null;
  const tag = net0.match(/tag=(\d+)/)?.[1] ?? null;
  const mtu = net0.match(/mtu=(\d+)/)?.[1] ?? null;
  return { model, mac, bridge, tag, mtu };
}

/**
 * Build net0 like the working reference VM (model/bridge/tag) but keep this VM's MAC.
 * Always firewall=0 — template firewall=1 blocks SSH at the hypervisor.
 */
export function buildNet0LikeReference(
  clonedNet0: string | undefined,
  referenceNet0: string | undefined,
  fallbackBridge: string,
): string {
  const clone = parseNet0(clonedNet0);
  const ref = parseNet0(referenceNet0);
  const model = ref.model || clone.model || "virtio";
  const mac = clone.mac;
  const bridge = ref.bridge || clone.bridge || fallbackBridge;
  const parts: string[] = [];
  if (mac) {
    parts.push(`${model}=${mac}`);
  } else {
    parts.push(model);
  }
  parts.push(`bridge=${bridge}`);
  if (ref.tag) parts.push(`tag=${ref.tag}`);
  if (ref.mtu) parts.push(`mtu=${ref.mtu}`);
  parts.push("firewall=0");
  return parts.join(",");
}

const HARDWARE_KEYS = [
  "scsihw",
  "bios",
  "machine",
  "sockets",
  "cpu",
  "numa",
  "vga",
  "serial0",
] as const;

/** Copy boot/network hardware fields from a known-working VM on the same node. */
export function pickReferenceHardwareFields(
  reference: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of HARDWARE_KEYS) {
    if (reference[key]) out[key] = reference[key];
  }
  return out;
}
