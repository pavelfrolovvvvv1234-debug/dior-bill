/**
 * Push billing rootPasswordEnc into the guest via qemu-guest-agent.
 * Use when SSH/WinSCP reaches the host but password is "Access denied"
 * (template ignored cloud-init cipassword).
 *
 * Usage: pnpm exec tsx scripts/sync-guest-password.ts testoepta
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { decrypt } from "../src/lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { resolveVpsLoginUser } from "../src/servers/vps-access";

loadMonorepoEnv();

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/sync-guest-password.ts <hostname>");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
    include: { node: true, service: true },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    console.error(`VPS not found / no VMID / no IP: ${name}`);
    process.exit(1);
  }
  if (!vps.rootPasswordEnc) {
    console.error("No rootPasswordEnc in billing DB");
    process.exit(1);
  }

  let password: string;
  try {
    password = decrypt(vps.rootPasswordEnc);
  } catch {
    console.error("Cannot decrypt rootPasswordEnc — check ENCRYPTION_KEY");
    process.exit(1);
  }

  const user = resolveVpsLoginUser(vps.os);
  const client = getProxmoxClient();
  if (!client) {
    console.error("Proxmox client unavailable");
    process.exit(1);
  }
  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);

  console.log(`=== ${vps.hostname} ===`);
  console.log(`vmid=${vps.proxmoxVmid} ip=${vps.primaryIp} user=${user}`);

  const ok = await client.guestSetUserPassword(node, vps.proxmoxVmid, user, password);
  if (!ok) {
    console.error("Failed to set password in guest");
    process.exit(1);
  }

  console.log("\n=== WinSCP / PuTTY ===");
  console.log(`Host: ${vps.primaryIp}  Port: 22  User: ${user}`);
  console.log(`Password: ${password}`);
  console.log("(Clear any saved wrong password in WinSCP first)");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
