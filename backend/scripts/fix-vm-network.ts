/**
 * Fix hypervisor net0 firewall + cloud-init on an existing VM (no re-clone).
 * Usage: pm2 stop dior-worker && pnpm exec tsx scripts/fix-vm-network.ts testepta
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { runVpsNetworkRepairJob } from "../src/proxmox/repair-network";
import { resolveVpsLoginUser } from "../src/servers/vps-access";

loadMonorepoEnv();

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/fix-vm-network.ts <hostname>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    console.error(`VPS not found or not linked: ${name}`);
    process.exit(1);
  }

  console.log(`Repair network ${vps.hostname} vmid=${vps.proxmoxVmid} ip=${vps.primaryIp}`);
  const ready = await runVpsNetworkRepairJob(vps.id);
  const user = resolveVpsLoginUser(vps.os);
  console.log(
    ready
      ? `OK — PuTTY: ${user}@${vps.primaryIp} (password from cabinet)`
      : `Still pending — wait 3 min and retry PuTTY: ${user}@${vps.primaryIp}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
