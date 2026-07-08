/**
 * Fix hypervisor net0 firewall + cloud-init on an existing VM (no re-clone).
 * Usage:
 *   pm2 stop dior-worker && pnpm exec tsx scripts/fix-vm-network.ts testepta
 *   pnpm exec tsx scripts/fix-vm-network.ts testepta --rebuild   # fresh re-clone (skips repair)
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { runVpsNetworkRepairJob } from "../src/proxmox/repair-network";
import { rebuildVpsKeepingIp } from "../src/proxmox/rebuild-fresh";
import { resolveVpsLoginUser } from "../src/servers/vps-access";
import { createConnection } from "node:net";

loadMonorepoEnv();

function tcpProbe(host: string, port: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: timeoutMs });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--rebuild");
  const rebuild = process.argv.includes("--rebuild");
  const name = args[0]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/fix-vm-network.ts <hostname> [--rebuild]");
    process.exit(1);
  }
  if (!isProxmoxConfigured()) {
    console.error("Proxmox not configured");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: { OR: [{ hostname: name }, { service: { label: name } }] },
  });
  if (!vps?.primaryIp) {
    console.error(`VPS not found or no IP: ${name}`);
    process.exit(1);
  }

  let ready = false;
  let sshOpen = false;
  let ip = vps.primaryIp;

  if (rebuild) {
    console.log(`Fresh re-clone ${vps.hostname} ip=${ip} (skip repair, ~10-15 min — do NOT Ctrl+C)`);
    const result = await rebuildVpsKeepingIp(vps.id);
    ip = result.ip ?? ip;
    sshOpen = ip ? await tcpProbe(ip, 22) : false;
    ready = sshOpen;
    console.log(
      `Rebuild done: status=${result.status} ip=${ip} vmid=${result.vmid} SSH=${sshOpen ? "OPEN" : "closed"}`,
    );
  } else {
    if (!vps.proxmoxVmid) {
      console.error(`VPS not linked to Proxmox: ${name}`);
      process.exit(1);
    }
    console.log(`Repair network ${vps.hostname} vmid=${vps.proxmoxVmid} ip=${ip}`);
    ready = await runVpsNetworkRepairJob(vps.id);
    sshOpen = await tcpProbe(ip, 22);
    console.log(`SSH port 22 ${ip}: ${sshOpen ? "OPEN" : "closed/timeout"}`);
    if (!ready || !sshOpen) {
      console.error("\n>>> Repair failed. Run with --rebuild for fresh re-clone:");
      console.error(`>>> pnpm exec tsx scripts/fix-vm-network.ts ${vps.hostname} --rebuild`);
    }
  }

  const user = resolveVpsLoginUser(vps.os);
  console.log(
    ready && sshOpen
      ? `OK — PuTTY: ${user}@${ip} (password from cabinet)`
      : `FAILED — guest network/SSH not working on ${ip}`,
  );

  await prisma.$disconnect();
  if (!ready || !sshOpen) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
