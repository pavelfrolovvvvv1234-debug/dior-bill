/**
 * Who owns an IP — shared registry (billing + TG bot) + live Proxmox scan.
 * Usage: pnpm exec tsx scripts/who-owns-ip.ts 45.74.7.188
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { syncProxmoxClusterToRegistry } from "../src/proxmox/proxmox-registry-sync";
import { resolveProxmoxNetwork } from "../src/proxmox/ip-allocate";

loadMonorepoEnv();

async function main() {
  const ip = process.argv[2]?.trim();
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    console.error("Usage: pnpm exec tsx scripts/who-owns-ip.ts <ipv4>");
    process.exit(1);
  }

  console.log(`=== Registry (shared DB: billing + TG bot) ===`);
  const row = await prisma.networkIpAllocation.findUnique({ where: { ip } });
  if (!row) {
    console.log(`No row in network_ip_allocations for ${ip}`);
  } else {
    console.log(JSON.stringify(row, null, 2));
    if (row.vpsId) {
      const vps = await prisma.vpsInstance.findUnique({
        where: { id: row.vpsId },
        select: { hostname: true, proxmoxVmid: true, service: { select: { label: true, status: true } } },
      });
      if (vps) {
        console.log(
          `Billing VPS: ${vps.hostname} (${vps.service.label}) status=${vps.service.status} vmid=${vps.proxmoxVmid}`,
        );
      }
    }
  }

  const billingByIp = await prisma.vpsInstance.findFirst({
    where: { primaryIp: ip },
    select: { hostname: true, proxmoxVmid: true, service: { select: { label: true, status: true } } },
  });
  if (billingByIp) {
    console.log(
      `Billing vps_instances.primaryIp: ${billingByIp.hostname} vmid=${billingByIp.proxmoxVmid} status=${billingByIp.service.status}`,
    );
  }

  if (!isProxmoxConfigured()) {
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== Proxmox live (source of truth for running VMs) ===`);
  const client = getProxmoxClient()!;
  const prefix = ip.split(".").slice(0, 3).join(".");
  const inventory = await client.collectClusterVmInventory(prefix);
  const matches = inventory.filter((vm) => vm.ips.includes(ip));
  if (matches.length === 0) {
    console.log(`No VM on Proxmox currently reports ${ip} (destroyed or guest-agent/ipconfig empty)`);
  } else {
    for (const vm of matches) {
      console.log(`vmid=${vm.vmid} name=${vm.name} node=${vm.node} kind=${vm.kind}`);
      try {
        const cfg = await client.getVmConfig(vm.node, vm.vmid);
        console.log(`  ipconfig0=${cfg.ipconfig0 ?? "—"} status via config`);
      } catch {
        /* lxc or gone */
      }
    }
  }

  const network = await resolveProxmoxNetwork("debian-12");
  const sync = await syncProxmoxClusterToRegistry(network, { force: true });
  console.log(`\nCluster sync: ${sync.occupied.has(ip) ? "IP marked OCCUPIED" : "IP not on any VM scan"}`);
  console.log(`Total occupied in subnet: ${sync.occupied.size}, VMs scanned: ${sync.vmCount}`);

  if (row && matches.length === 0 && row.status !== "released") {
    console.log(
      `\nOK for rebuild: registry reserves ${ip} for ${row.owner} — TG bot cannot take it while row is reserved/active`,
    );
  }
  if (matches.length > 1) {
    console.warn(`\nCONFLICT: multiple VMs claim ${ip} on Proxmox!`);
  }
  if (row && matches.length === 1 && row.vmid && matches[0].vmid !== row.vmid) {
    console.warn(
      `\nMISMATCH: registry vmid=${row.vmid} but Proxmox vmid=${matches[0].vmid} has ${ip}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
