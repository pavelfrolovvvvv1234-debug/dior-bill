import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { syncVpsIpFromProxmox } from "../src/proxmox";

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
  const ip = await syncVpsIpFromProxmox(vps.id);
  if (!ip) {
    console.error("IP not detected — install qemu-guest-agent on template/VM and retry");
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
