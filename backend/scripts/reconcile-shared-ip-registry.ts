import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  getProxmoxConfig,
  isSharedIpRegistryEnabled,
  reconcileSharedRegistryWithProxmox,
} from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  if (!getProxmoxConfig()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }
  if (!isSharedIpRegistryEnabled()) {
    console.error("Set PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 or SHARED_IP_REGISTRY=1");
    process.exit(1);
  }

  const r = await reconcileSharedRegistryWithProxmox();
  console.log("Stale reserved released:", r.staleReserved);
  console.log("Ghost VM rows released:", r.releasedGhost);
  console.log("Imported from Proxmox:", r.imported, `(skipped ${r.skipped})`);
  if (r.findings.length) {
    console.log("Details:");
    for (const f of r.findings) console.log(" -", f);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
