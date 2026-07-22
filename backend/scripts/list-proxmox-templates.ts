/**
 * List QEMU templates on Proxmox and print a ready-to-paste PROXMOX_TEMPLATE_MAP.
 *
 * Usage: cd backend && pnpm exec tsx scripts/list-proxmox-templates.ts
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import {
  getProxmoxClient,
  getProxmoxConfig,
  describeTemplateMapCoverage,
  ALL_TEMPLATE_MAP_KEYS,
  osToTemplateMapKey,
} from "../src/proxmox";

loadMonorepoEnv();

/** Heuristic: guess map key from Proxmox template name. */
function guessKeyFromName(name: string): string | null {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const rules: [RegExp, string][] = [
    [/debian13|deb13/, "debian13"],
    [/debian12|deb12|debian$/, "debian12"],
    [/debian11|deb11/, "debian11"],
    [/ubuntu2404|ubuntu24/, "ubuntu2404"],
    [/ubuntu2204|ubuntu22/, "ubuntu2204"],
    [/ubuntu2004|ubuntu20/, "ubuntu2004"],
    [/winserver2025|windows.?server.?2025|ws2025/, "winserver2025"],
    [/winserver2019|windows.?server.?2019|ws2019/, "winserver2019"],
    [/winserver2016|windows.?server.?2016|ws2016/, "winserver2016"],
    [/winserver2012|windows.?server.?2012|ws2012/, "winserver2012"],
    [/windows11|win11/, "windows11"],
    [/windows10|win10/, "windows10"],
    [/almalinux9|alma9/, "almalinux9"],
    [/almalinux8|alma8/, "almalinux8"],
    [/rockylinux9|rocky9|rocky$/, "rockylinux9"],
    [/rockylinux8|rocky8/, "rockylinux8"],
    [/centosstream9|centos9|centosstream|centos$/, "centos9"],
    [/freebsd/, "freebsd"],
  ];
  for (const [re, key] of rules) {
    if (re.test(n) || re.test(name.toLowerCase())) return key;
  }
  return null;
}

async function main() {
  const config = getProxmoxConfig();
  const client = getProxmoxClient();
  if (!config || !client) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const nodes = await client.listNodes().catch(async () => [{ node: config.node }]);
  const templates: { node: string; vmid: number; name: string; guess: string | null }[] = [];

  for (const n of nodes) {
    const node = typeof n === "string" ? n : (n as { node: string }).node;
    const vms = await client.listVms(node);
    for (const vm of vms) {
      if (vm.template !== 1) continue;
      const name = vm.name ?? `vm-${vm.vmid}`;
      templates.push({
        node,
        vmid: vm.vmid,
        name,
        guess: guessKeyFromName(name),
      });
    }
  }

  console.log("=== Proxmox QEMU templates ===");
  if (!templates.length) {
    console.log("(none found — convert a VM to template in Proxmox UI)");
  }
  for (const t of templates.sort((a, b) => a.vmid - b.vmid)) {
    console.log(
      `  vmid=${t.vmid}  node=${t.node}  name=${t.name}` +
        (t.guess ? `  → suggested key "${t.guess}"` : "  → (name not recognized)"),
    );
  }

  const suggested: Record<string, number> = { ...config.templateMap };
  for (const t of templates) {
    if (t.guess && suggested[t.guess] == null) suggested[t.guess] = t.vmid;
  }

  console.log("\n=== Current PROXMOX_TEMPLATE_MAP coverage ===");
  const cov = describeTemplateMapCoverage();
  for (const c of cov.configured) {
    console.log(`  ${c.key}=${c.vmid}`);
  }
  if (!cov.configured.length) console.log("  (empty)");

  console.log("\n=== Suggested .env line (edit VMIDs to match your cluster) ===");
  console.log(`PROXMOX_TEMPLATE_MAP='${JSON.stringify(suggested)}'`);

  console.log("\n=== Panel OS → map key (add missing keys to .env) ===");
  const panelOs = [
    "windows-server-2019",
    "windows-server-2025",
    "windows-server-2012",
    "windows-server-2016",
    "windows-10",
    "windows-11",
    "almalinux-8",
    "almalinux-9",
    "rocky-linux",
    "centos-9",
    "debian-11",
    "debian-12",
    "debian-13",
    "freebsd",
    "ubuntu-22.04",
    "ubuntu-24.04",
  ];
  for (const os of panelOs) {
    const key = osToTemplateMapKey(os);
    const vmid = suggested[key];
    console.log(`  ${os.padEnd(22)} → ${key.padEnd(14)} ${vmid ? `vmid ${vmid}` : "MISSING"}`);
  }

  console.log("\nKnown map keys:", ALL_TEMPLATE_MAP_KEYS.join(", "));
  console.log(
    "\nOnly OSes with a VMID in PROXMOX_TEMPLATE_MAP appear in the order form after deploy.",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
