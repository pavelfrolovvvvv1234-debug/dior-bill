import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  getProxmoxClient,
  getProxmoxConfig,
  listOccupiedSharedRegistryIps,
  resolveProxmoxNetwork,
  syncSharedRegistryFromProxmox,
  getSharedRegistryNetwork,
} from "../src/proxmox";

loadMonorepoEnv();

async function collectIpsForInitialSync(
  network: Awaited<ReturnType<typeof resolveProxmoxNetwork>>,
): Promise<Set<string>> {
  const used = new Set<string>();
  const client = getProxmoxClient();
  if (client) {
    const scan = await client.collectUsedIpsOnClusterDetailed(network.prefix);
    for (const ip of scan.ips) used.add(ip);
  }
  used.add(network.gateway);
  return used;
}

async function main() {
  const config = getProxmoxConfig();
  if (!config) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const network = await resolveProxmoxNetwork("debian12");
  const used = await collectIpsForInitialSync(network);
  const networkCidr = getSharedRegistryNetwork(network);
  const before = await listOccupiedSharedRegistryIps(networkCidr);

  console.log(`Network: ${networkCidr}`);
  console.log(`Proxmox/billing scan: ${used.size} IPs`);
  console.log(`Registry before: ${before.size} occupied`);

  const result = await syncSharedRegistryFromProxmox({
    network,
    ips: used,
    dryRun,
  });

  const after = dryRun ? before.size + result.inserted : (await listOccupiedSharedRegistryIps(networkCidr)).size;

  console.log(`${dryRun ? "Would insert" : "Inserted"}: ${result.inserted}, skipped (exists): ${result.skipped}`);
  console.log(`Registry after: ${after} occupied`);
  if (!dryRun) {
    console.log("Done — TG bot and billing now share the same IP table.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
