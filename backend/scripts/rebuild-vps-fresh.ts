/**
 * Destroy broken VM and re-clone from template (same IP) — fixes cloud-init / SSH timeout.
 * Usage: pm2 stop dior-worker && pnpm exec tsx scripts/rebuild-vps-fresh.ts serv
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { rebuildVpsKeepingIp } from "../src/proxmox/rebuild-fresh";

loadMonorepoEnv();

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/rebuild-vps-fresh.ts <hostname>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
    include: { service: true, node: true },
  });
  if (!vps) {
    console.error(`VPS not found: ${name}`);
    process.exit(1);
  }

  const result = await rebuildVpsKeepingIp(vps.id);
  console.log(
    `Done: status=${result.status} ip=${result.ip} vmid=${result.vmid} — wait 2 min then PuTTY`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
