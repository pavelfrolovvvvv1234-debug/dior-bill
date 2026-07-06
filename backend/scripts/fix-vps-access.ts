/**
 * Push billing credentials to Proxmox cloud-init and reboot VM.
 * Usage: pnpm exec tsx scripts/fix-vps-access.ts hostname
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { ensureVpsProxmoxAccess } from "../src/proxmox/ensure-vps-access";
import { resolveVpsLoginUser } from "../src/servers/vps-access";
import { decrypt } from "../src/lib/crypto";

loadMonorepoEnv();

async function main() {
  const hostname = process.argv[2]?.trim();
  if (!hostname) {
    console.error("Usage: pnpm exec tsx scripts/fix-vps-access.ts <hostname>");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname }, { service: { label: hostname } }] },
    include: { service: true },
  });
  if (!vps) {
    console.error(`VPS not found: ${hostname}`);
    process.exit(1);
  }

  console.log(
    `Fixing ${vps.hostname} vmid=${vps.proxmoxVmid} ip=${vps.primaryIp} status=${vps.service.status}`,
  );
  const result = await ensureVpsProxmoxAccess(vps.id, { reboot: true });
  const user = resolveVpsLoginUser(vps.os);
  const password = vps.rootPasswordEnc
    ? decrypt(vps.rootPasswordEnc)
    : "(generated — refresh page)";
  console.log(`Done. SSH: ssh ${user}@${result.ip ?? vps.primaryIp}`);
  console.log(`Password: ${password}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
