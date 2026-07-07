/**
 * Compare Proxmox config between two VMs (e.g. working TG bot vs billing).
 * Usage: pnpm exec tsx scripts/compare-vm-config.ts 208 211
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { getProxmoxConfig, isProxmoxConfigured } from "../src/proxmox/config";

loadMonorepoEnv();

const KEYS = [
  "net0",
  "ipconfig0",
  "ide2",
  "ciuser",
  "citype",
  "boot",
  "scsi0",
  "virtio0",
  "agent",
  "firewall",
  "name",
];

async function main() {
  const a = process.argv[2]?.trim();
  const b = process.argv[3]?.trim();
  if (!a || !b) {
    console.error("Usage: pnpm exec tsx scripts/compare-vm-config.ts <vmid-a> <vmid-b>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const client = getProxmoxClient()!;
  const node = getProxmoxNodeName(getProxmoxConfig()?.node);
  const vmidA = Number(a);
  const vmidB = Number(b);

  const [cfgA, cfgB, stA, stB] = await Promise.all([
    client.getVmConfig(node, vmidA),
    client.getVmConfig(node, vmidB),
    client.getVmStatus(node, vmidA).catch(() => ({ status: "?" })),
    client.getVmStatus(node, vmidB).catch(() => ({ status: "?" })),
  ]);

  console.log(`=== VM ${vmidA} (${cfgA.name ?? "?"}) status=${stA.status} ===`);
  for (const k of KEYS) {
    if (cfgA[k]) console.log(`  ${k}=${cfgA[k]}`);
  }
  const agentA = await client.pingGuestAgent(node, vmidA);
  console.log(`  guest-agent=${agentA ? "up" : "down"}`);

  console.log(`\n=== VM ${vmidB} (${cfgB.name ?? "?"}) status=${stB.status} ===`);
  for (const k of KEYS) {
    if (cfgB[k]) console.log(`  ${k}=${cfgB[k]}`);
  }
  const agentB = await client.pingGuestAgent(node, vmidB);
  console.log(`  guest-agent=${agentB ? "up" : "down"}`);

  console.log("\n=== DIFF (values differ) ===");
  for (const k of KEYS) {
    const va = cfgA[k] ?? "";
    const vb = cfgB[k] ?? "";
    if (va !== vb) {
      console.log(`  ${k}:\n    A: ${va || "(empty)"}\n    B: ${vb || "(empty)"}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
