/**
 * Fix hypervisor net0 firewall + cloud-init on an existing VM (no re-clone).
 * Use when SSH times out but VM is running (template firewall=1 blocks traffic).
 *
 * Usage:
 *   pm2 stop dior-worker
 *   cd backend && pnpm exec tsx scripts/fix-vm-network.ts serv
 *   pm2 start dior-worker
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { decrypt } from "../src/lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { getProxmoxConfig, isProxmoxConfigured, resolveProxmoxCiUser } from "../src/proxmox/config";
import { getProxmoxGateway } from "../src/proxmox/ip-pool";
import { waitForVpsProvisionReady } from "../src/proxmox/provision-ready";
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
    include: { node: true },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    console.error(`VPS not found or not linked: ${name}`);
    process.exit(1);
  }

  const client = getProxmoxClient()!;
  const config = getProxmoxConfig()!;
  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const vmid = vps.proxmoxVmid;
  const ciuser = resolveProxmoxCiUser(vps.os);

  const before = await client.getVmConfig(node, vmid);
  console.log(`Before: net0=${before.net0 ?? "—"} ipconfig0=${before.ipconfig0 ?? "—"}`);

  let password: string;
  if (vps.rootPasswordEnc) {
    password = decrypt(vps.rootPasswordEnc);
  } else {
    console.error("No password in DB — run rebuild-vps-fresh first");
    process.exit(1);
  }

  const wasRunning = (await client.getVmStatus(node, vmid)).status === "running";
  if (wasRunning) {
    console.log("Stopping VM for cloud-init regen (one-time network fix)...");
    await client.stopVm(node, vmid);
  }

  await client.ensureCloudInitDrive(node, vmid, config.storage);
  await client.configureVm({
    vmid,
    node,
    hostname: vps.hostname,
    cores: vps.cpuCores,
    memoryMb: vps.ramMb,
    diskGb: vps.diskGb,
    templateVmid: 0,
    primaryIp: vps.primaryIp,
    gateway: config.gateway ?? getProxmoxGateway(),
    ipCidr: config.ipCidr,
    rootPassword: password,
    ciuser,
    storage: config.storage,
    bridge: config.bridge,
  });
  await client.regenerateCloudInit(node, vmid);
  await client.startVm(node, vmid);

  const after = await client.getVmConfig(node, vmid);
  console.log(`After:  net0=${after.net0 ?? "—"} ipconfig0=${after.ipconfig0 ?? "—"}`);

  console.log("Waiting for guest network (up to 5 min)...");
  const ready = await waitForVpsProvisionReady(node, vmid, vps.primaryIp);
  const user = resolveVpsLoginUser(vps.os);
  console.log(
    ready
      ? `OK — SSH: ${user}@${vps.primaryIp} (password from cabinet)`
      : `Guest IP not confirmed yet — wait 2 min and try PuTTY: ${user}@${vps.primaryIp}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
