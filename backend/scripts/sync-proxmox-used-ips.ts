import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  collectAllUsedProxmoxIps,
  getProxmoxConfig,
  getProxmoxNodeName,
  resolveProxmoxNetwork,
  syncProxmoxUsedIpsToInventory,
} from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  const config = getProxmoxConfig();
  if (!config) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const network = await resolveProxmoxNetwork("debian12");
  const node = getProxmoxNodeName();
  const used = await collectAllUsedProxmoxIps(network, node);
  const sync = await syncProxmoxUsedIpsToInventory();

  const sorted = [...used].sort((a, b) => {
    const ao = Number.parseInt(a.split(".")[3] ?? "0", 10);
    const bo = Number.parseInt(b.split(".")[3] ?? "0", 10);
    return ao - bo;
  });

  console.log(`Subnet: ${network.prefix}.0/${network.cidr} gw ${network.gateway}`);
  console.log(`Used (Proxmox + billing + reserved): ${used.size}`);
  console.log(`Free slots in /24 (approx): ${Math.max(0, 245 - used.size)}`);
  console.log("Occupied:", sorted.join(", ") || "(none detected)");
  console.log("Next free for web billing:", sync.nextFree ?? "NONE — subnet full or undetected IPs missing from scan");
  if (!sync.nextFree) {
    console.error("Add more IPs via PROXMOX_NETWORK (wider pool) or export TG bot IPs to PROXMOX_RESERVED_IPS");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
