/**
 * Verify Proxmox API connectivity.
 * Usage (from backend/): set PROXMOX_* env vars, then `npm run verify-proxmox`
 */
import { verifyProxmoxIntegration, getProxmoxConfig } from "../src/proxmox";

async function main() {
  const config = getProxmoxConfig();
  if (!config) {
    console.error("Proxmox not configured. Set PROXMOX_BASE_URL, PROXMOX_TOKEN_ID, PROXMOX_TOKEN_SECRET");
    process.exit(1);
  }
  console.log("API URL:", config.apiUrl);
  console.log("Node:", config.node);
  console.log("Storage:", config.storage);
  console.log("Templates:", Object.keys(config.templateMap).length);

  const result = await verifyProxmoxIntegration();
  console.log("Nodes:", result.nodes.map((n) => `${n.node} (${n.status})`).join(", "));
  console.log("Next VMID:", result.nextVmid);
  console.log("OK — Proxmox API is reachable");
}

main().catch((err) => {
  console.error("Proxmox verification failed:", err.message ?? err);
  process.exit(1);
});
