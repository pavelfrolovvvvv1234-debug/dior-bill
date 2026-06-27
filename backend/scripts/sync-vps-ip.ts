import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { findProxmoxVmidByHostname, linkVpsToProxmoxVm, syncVpsIpFromProxmox } from "../src/proxmox";

loadMonorepoEnv();

async function main() {
  const hostname = process.argv.slice(2).find((a) => !a.startsWith("-"))?.trim();
  if (!hostname) {
    console.error("Usage: pnpm run sync-vps-ip <hostname>");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname }, { service: { label: hostname } }] },
    include: { service: true },
  });
  if (!vps) {
    console.error("VPS not found:", hostname);
    process.exit(1);
  }

  console.log(`Syncing IP for ${vps.hostname} vmid=${vps.proxmoxVmid} status=${vps.service.status}`);

  if (!vps.proxmoxVmid) {
    const onPve = await findProxmoxVmidByHostname(vps.hostname);
    if (onPve) {
      console.log(`Found on Proxmox: vmid=${onPve.vmid} name=${onPve.name}`);
      await linkVpsToProxmoxVm(vps.id);
    } else {
      console.error("No VM on Proxmox for this hostname — run:");
      console.error(`  pnpm run retry-provision -- ${hostname} --force`);
      process.exit(1);
    }
  }

  const ip = await syncVpsIpFromProxmox(vps.id);
  if (!ip) {
    console.error("IP not detected. In Proxmox UI: VM → Console (not SSH pve01), then:");
    console.error("  apt install -y qemu-guest-agent && systemctl start qemu-guest-agent");
    console.error("Then run this command again.");
    process.exit(1);
  }
  console.log("OK ip=", ip);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
