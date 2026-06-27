/**
 * Verify Proxmox API connectivity.
 * Usage (from backend/): set PROXMOX_* in monorepo root `.env`, then `pnpm run verify-proxmox`
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { verifyProxmoxIntegration, getProxmoxConfig } from "../src/proxmox";

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
  console.log("Next VMID:", result.nextVmid);
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
