/**
 * Diagnose + fix VPS network (timeout in PuTTY/WinSCP = IP/VM down, not wrong password).
 * Usage: pnpm exec tsx scripts/diagnose-vps.ts serv
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { getProxmoxClient, getProxmoxNodeName } from "../src/proxmox/client";
import { isProxmoxConfigured } from "../src/proxmox/config";
import { ensureVpsProxmoxAccess } from "../src/proxmox/ensure-vps-access";
import { resolveVpsLoginUser } from "../src/servers/vps-access";
import { decrypt } from "../src/lib/crypto";

loadMonorepoEnv();

async function tcpProbe(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  try {
    const { Socket } = await import("node:net");
    return await new Promise((resolve) => {
      const s = new Socket();
      const done = (ok: boolean) => {
        s.destroy();
        resolve(ok);
      };
      s.setTimeout(timeoutMs);
      s.once("connect", () => done(true));
      s.once("timeout", () => done(false));
      s.once("error", () => done(false));
      s.connect(port, host);
    });
  } catch {
    return false;
  }
}

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm exec tsx scripts/diagnose-vps.ts <hostname>");
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

  console.log("=== Billing DB ===");
  console.log(`hostname=${vps.hostname} service=${vps.service.status} os=${vps.os}`);
  console.log(`ip=${vps.primaryIp} vmid=${vps.proxmoxVmid}`);

  if (!isProxmoxConfigured() || !vps.proxmoxVmid) {
    console.error("Proxmox not configured or VM not linked — provision incomplete");
    process.exit(1);
  }

  const client = getProxmoxClient()!;
  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const vmid = vps.proxmoxVmid;

  console.log("\n=== Proxmox VM ===");
  let vmStatus = "unknown";
  try {
    const st = await client.getVmStatus(node, vmid);
    vmStatus = st.status;
    console.log(`node=${node} vmid=${vmid} power=${st.status}`);
  } catch (e) {
    console.error(`Cannot read VM status: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  const cfg = await client.getVmConfig(node, vmid);
  const pveIp = client.parseIpFromConfig(cfg);
  const pveUser = cfg.ciuser ?? "(none)";
  console.log(`ipconfig0=${cfg.ipconfig0 ?? "MISSING"}`);
  console.log(`ciuser=${pveUser} net0=${cfg.net0 ?? "MISSING"}`);
  if (cfg.net0?.includes("firewall=1")) {
    console.warn("net0 has firewall=1 — Proxmox blocks SSH! Run: pnpm run fix-vm-network -- serv");
  }
  console.log(`ide2=${cfg.ide2 ?? "MISSING — cloud-init drive not attached!"}`);

  const agentUp = await client.pingGuestAgent(node, vmid);
  console.log(`guest-agent=${agentUp ? "up" : "DOWN (OS likely has no IP yet — PuTTY will timeout)"}`);

  if (vps.primaryIp && pveIp && vps.primaryIp !== pveIp) {
    console.warn(`MISMATCH: billing IP ${vps.primaryIp} != Proxmox ${pveIp}`);
  }
  if (vps.primaryIp && !pveIp) {
    console.warn("Proxmox has NO ipconfig0 — VM may have no routable IP on the network");
  }

  if (vps.primaryIp) {
    const prefix = vps.primaryIp.split(".").slice(0, 3).join(".");
    const conflict = await client.isIpInUseOnCluster(vps.primaryIp, prefix);
    console.log(`IP ${vps.primaryIp} on cluster scan: ${conflict ? "IN USE" : "not seen"}`);
  }

  if (vmStatus !== "running") {
    console.log("\n>>> VM is NOT running — starting...");
    await client.startVm(node, vmid);
    await new Promise((r) => setTimeout(r, 8000));
    const st2 = await client.getVmStatus(node, vmid);
    console.log(`power after start: ${st2.status}`);
  }

  if (vps.primaryIp) {
    console.log(`\n=== TCP probe ${vps.primaryIp}:22 (from billing server — may fail if different network) ===`);
    const open = await tcpProbe(vps.primaryIp, 22);
    console.log(
      open
        ? "Port 22 OPEN from billing host"
        : "Port 22 not reachable from billing host (try PuTTY from your PC anyway)",
    );
  }

  const needsFix =
    vmStatus !== "running" ||
    !cfg.ipconfig0 ||
    (vps.primaryIp && pveIp !== vps.primaryIp);

  if (needsFix || process.argv.includes("--fix")) {
    const forceReboot = process.argv.includes("--force-reboot");
    console.log(
      `\n>>> Applying cloud-init${forceReboot ? " + forced reboot" : " (no stop if VM running)"}...`,
    );
    await ensureVpsProxmoxAccess(vps.id, {
      reboot: true,
      waitForGuest: false,
      forceStop: forceReboot,
    });
    await new Promise((r) => setTimeout(r, 15_000));
    if (vps.primaryIp) {
      const open2 = await tcpProbe(vps.primaryIp, 22, 8000);
      console.log(`After fix — port 22: ${open2 ? "OPEN" : "still TIMEOUT (wait 1–2 min, retry PuTTY)"}`);
    }
  }

  const user = resolveVpsLoginUser(vps.os);
  const password = vps.rootPasswordEnc ? decrypt(vps.rootPasswordEnc) : "?";
  console.log("\n=== PuTTY / WinSCP ===");
  console.log(`Host: ${vps.primaryIp}  Port: 22  User: ${user}`);
  console.log(`Password: ${password}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
