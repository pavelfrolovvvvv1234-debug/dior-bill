import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  getProxmoxConfig,
  isProxmoxIpPoolConfigured,
  parseProxmoxIpPool,
  syncProxmoxIpPoolFromEnv,
} from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  const config = getProxmoxConfig();
  if (!config) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const pool = parseProxmoxIpPool();
  if (pool.length === 0) {
    console.error("PROXMOX_IP_POOL is empty. Example in .env:");
    console.error("PROXMOX_IP_POOL=45.74.7.10,45.74.7.11,45.74.7.12");
    console.error("PROXMOX_GATEWAY=45.74.7.1");
    console.error("PROXMOX_IP_CIDR=24");
    process.exit(1);
  }

  const result = await syncProxmoxIpPoolFromEnv();
  console.log("Gateway:", config.gateway ?? "(auto .1)");
  console.log("CIDR:", `/${config.ipCidr}`);
  console.log("Pool:", pool.join(", "));
  console.log(
    `Synced to ${result.nodeHostname}: +${result.added} new, -${result.removed} fake placeholders, total ${result.poolSize}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
