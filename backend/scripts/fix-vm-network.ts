/**
 * Fix hypervisor net0 firewall + cloud-init on an existing VM (no re-clone).
 * Usage:
 *   pm2 stop dior-worker && pnpm exec tsx scripts/fix-vm-network.ts testepta
 *   pnpm exec tsx scripts/fix-vm-network.ts testepta --rebuild   # auto fresh re-clone if repair fails
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
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    console.error(`VPS not found or not linked: ${name}`);
    process.exit(1);
  }

  console.log(`Repair network ${vps.hostname} vmid=${vps.proxmoxVmid} ip=${vps.primaryIp}`);
  let ready = await runVpsNetworkRepairJob(vps.id);
  let sshOpen = await tcpProbe(vps.primaryIp, 22);
  console.log(`SSH port 22 ${vps.primaryIp}: ${sshOpen ? "OPEN" : "closed/timeout"}`);

  if (!ready || !sshOpen) {
    console.error(
      "\n>>> Proxmox config is OK but guest OS has no SSH (cloud-init inside disk is broken).",
    );
    if (rebuild) {
      console.log(">>> Starting fresh re-clone (same IP, new disk)...");
      const result = await rebuildVpsKeepingIp(vps.id);
      sshOpen = result.ip ? await tcpProbe(result.ip, 22) : false;
      ready = sshOpen;
      console.log(
        `Rebuild done: status=${result.status} ip=${result.ip} vmid=${result.vmid} SSH=${sshOpen ? "OPEN" : "closed"}`,
      );
    } else {
      console.error(
        `>>> Run: pnpm exec tsx scripts/fix-vm-network.ts ${vps.hostname} --rebuild`,
      );
      console.error(`>>> Or:  pnpm exec tsx scripts/rebuild-vps-fresh.ts ${vps.hostname}`);
    }
  }

  const user = resolveVpsLoginUser(vps.os);
  console.log(
    ready && sshOpen
      ? `OK — PuTTY: ${user}@${vps.primaryIp} (password from cabinet)`
      : `FAILED — guest network/SSH not working on ${vps.primaryIp}`,
  );

  await prisma.$disconnect();
  if (!ready || !sshOpen) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
