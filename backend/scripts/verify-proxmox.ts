/**
 * Verify Proxmox API connectivity.
 * Usage (from backend/): set PROXMOX_* in monorepo root `.env`, then `pnpm run verify-proxmox`
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  verifyProxmoxIntegration,
  getProxmoxConfig,
  isProxmoxIpPoolConfigured,
  parseProxmoxIpPool,
  syncProxmoxIpPoolFromEnv,
  syncProxmoxUsedIpsToInventory,
  resolveProxmoxNetwork,
  parseProxmoxReservedIps,
} from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  const config = getProxmoxConfig();
  if (!config) {
    console.error("Proxmox not configured. Set PROXMOX_BASE_URL, PROXMOX_TOKEN_ID, PROXMOX_TOKEN_SECRET");
    process.exit(1);
  }
  console.log("API URL:", config.apiUrl);
  console.log("Node:", config.node);
  console.log("Storage:", config.storage);
  console.log("TLS:", config.insecureTls ? "insecure (self-signed OK)" : "strict verify");
  if (!config.insecureTls) {
    console.error(
      "Strict TLS is on. PROXMOX_INSECURE_TLS=%s PROXMOX_VERIFY_TLS=%s",
      process.env.PROXMOX_INSECURE_TLS ?? "(unset)",
      process.env.PROXMOX_VERIFY_TLS ?? "(unset)",
    );
    console.error("Fix: set PROXMOX_INSECURE_TLS=1 and remove PROXMOX_VERIFY_TLS=1 in /var/www/dior-billing/.env");
  }
  console.log("Templates:", Object.keys(config.templateMap).length);

  const result = await verifyProxmoxIntegration();
  console.log("Nodes:", result.nodes.map((n) => `${n.node} (${n.status})`).join(", "));
  const configuredNode = config.node;
  const nodeNames = result.nodes.map((n) => n.node);
  if (!nodeNames.includes(configuredNode)) {
    console.error(
      `PROXMOX_NODE=${configuredNode} is not in cluster. Available: ${nodeNames.join(", ")}`,
    );
    process.exit(1);
  }
  console.log("Next VMID:", result.nextVmid);
  if (isProxmoxIpPoolConfigured()) {
    const sync = await syncProxmoxIpPoolFromEnv();
    console.log("IP pool:", parseProxmoxIpPool().length, "addresses →", sync.nodeHostname);
    console.log("Gateway:", config.gateway ?? "(auto .1)", `/${config.ipCidr}`);
  } else {
    const net = await resolveProxmoxNetwork("debian12");
    const occupancy = await syncProxmoxUsedIpsToInventory();
    const reservedEnv = parseProxmoxReservedIps();
    console.log(
      "IP mode: auto static cloud-init",
      `→ ${net.prefix}.0/${net.cidr}`,
      `gw ${net.gateway}`,
    );
    console.log(
      "Occupied (Proxmox + billing + TG reserved):",
      occupancy.used,
      reservedEnv.length ? `(+${reservedEnv.length} from PROXMOX_RESERVED_IPS)` : "",
    );
    console.log("Next free IP for web billing:", occupancy.nextFree ?? "NONE");
  }
  console.log("OK — Proxmox API is reachable");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Proxmox verification failed:", message);
  if (/unable to verify the first certificate/i.test(message)) {
    console.error("Hint: add PROXMOX_INSECURE_TLS=1 to /var/www/dior-billing/.env and restart dior-worker");
  }
  process.exit(1);
});
