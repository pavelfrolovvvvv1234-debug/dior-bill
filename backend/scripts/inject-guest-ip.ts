/**
 * Force-inject static IPv4 into a running guest via qemu-guest-agent.
 * Use when Proxmox ipconfig0 is set but SSH times out (template cloud-init ignored).
 *
 * Usage: pnpm exec tsx scripts/inject-guest-ip.ts testoepta
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { getProxmoxConfig, isProxmoxConfigured } from "../src/proxmox/config";
import { getProxmoxGateway } from "../src/proxmox/ip-pool";
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
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/inject-guest-ip.ts <hostname>");
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

  const client = getProxmoxClient()!;
  const config = getProxmoxConfig()!;
  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const ip = vps.primaryIp;
  const gw = config.gateway ?? getProxmoxGateway() ?? `${ip.split(".").slice(0, 3).join(".")}.1`;

  console.log(`=== ${vps.hostname} ===`);
  console.log(`status=${vps.service.status} vmid=${vps.proxmoxVmid} ip=${ip} gw=${gw}`);

  const agentUp = await client.pingGuestAgent(node, vps.proxmoxVmid);
  console.log(`guest-agent=${agentUp ? "up" : "DOWN"}`);
  if (!agentUp) {
    console.error("Guest agent not running — cannot inject. Wait 1–2 min or rebuild:");
    console.error(`  pnpm exec tsx scripts/fix-vm-network.ts ${vps.hostname} --rebuild`);
    process.exit(1);
  }

  const before = await client.getGuestAgentIps(node, vps.proxmoxVmid);
  console.log(`guest IPs before: ${before.join(", ") || "none"}`);

  if (before.includes(ip)) {
    console.log("Guest already has the billing IP.");
  } else {
    console.log(`Injecting ${ip}/${config.ipCidr} via ${gw}...`);
    const ok = await client.guestInjectStaticNetwork(
      node,
      vps.proxmoxVmid,
      ip,
      gw,
      config.ipCidr,
    );
    if (!ok) {
      console.error("Inject failed");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }

  const after = await client.getGuestAgentIps(node, vps.proxmoxVmid);
  console.log(`guest IPs after: ${after.join(", ") || "none"}`);

  const ssh = await tcpProbe(ip, 22);
  console.log(`SSH :22 from billing: ${ssh ? "OPEN" : "closed (try PuTTY from your PC)"}`);

  if (!after.includes(ip)) {
    console.error("Guest still missing IP — rebuild:");
    console.error(`  pm2 stop dior-worker && pnpm exec tsx scripts/fix-vm-network.ts ${vps.hostname} --rebuild && pm2 start dior-worker`);
    process.exit(1);
  }

  console.log(`OK — try: ssh root@${ip}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
