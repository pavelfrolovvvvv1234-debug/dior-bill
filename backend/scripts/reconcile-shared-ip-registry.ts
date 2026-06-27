import { loadMonorepoEnv } from "../src/lib/load-env";
import { getProxmoxConfig, reconcileSharedRegistryWithProxmox } from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  if (!getProxmoxConfig()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }
  const r = await reconcileSharedRegistryWithProxmox(undefined, { force: true });
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
