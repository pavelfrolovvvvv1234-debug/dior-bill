import { randomBytes } from "node:crypto";
import { prisma } from "@dior/database";
import { decrypt, encrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import { getProxmoxConfig, isProxmoxConfigured, resolveProxmoxCiUser } from "./config";
import { getProxmoxGateway, isPlaceholderIp } from "./ip-pool";

/** Do not stop a running VM during first-boot cloud-init (stop breaks Debian network). */
const CLOUD_INIT_GRACE_SEC = 480;

function generateRootPassword(): string {
  return randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
}

/**
 * Push billing IP + login/password to Proxmox cloud-init.
 * By default never stops a running VM — use forceStop for explicit repair scripts only.
 */
export async function ensureVpsProxmoxAccess(
  vpsId: string,
  options?: { reboot?: boolean; waitForGuest?: boolean; forceStop?: boolean },
): Promise<{ ip: string | null; ciuser: string }> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true },
  });
  if (!vps?.proxmoxVmid || !isProxmoxConfigured()) {
    return { ip: vps?.primaryIp ?? null, ciuser: resolveProxmoxCiUser(vps?.os ?? "debian-12") };
  }

  const client = getProxmoxClient();
  const config = getProxmoxConfig();
  if (!client || !config) {
    return { ip: vps.primaryIp, ciuser: resolveProxmoxCiUser(vps.os) };
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const vmid = vps.proxmoxVmid;
  const ciuser = resolveProxmoxCiUser(vps.os);

  let password: string | null = null;
  if (vps.rootPasswordEnc) {
    try {
      password = decrypt(vps.rootPasswordEnc);
    } catch {
      password = null;
    }
  }
  if (!password) {
    password = generateRootPassword();
    await prisma.vpsInstance.update({
      where: { id: vpsId },
      data: { rootPasswordEnc: encrypt(password) },
    });
  }

  const primaryIp = vps.primaryIp;
  const useStaticIp = !!primaryIp && !isPlaceholderIp(primaryIp);

  const status = await client.getVmStatus(node, vmid).catch(() => ({ status: "unknown" }));
  const isRunning = status.status === "running";
  const uptimeSec = isRunning ? await client.getVmUptimeSec(node, vmid) : 0;
  const inCloudInitGrace = isRunning && uptimeSec > 0 && uptimeSec < CLOUD_INIT_GRACE_SEC;

  let configMismatch = false;
  if (useStaticIp) {
    const cfg = await client.getVmConfig(node, vmid);
    const pveIp = client.parseIpFromConfig(cfg);
    const pveUser = cfg.ciuser?.trim();
    configMismatch = !cfg.ipconfig0 || pveIp !== primaryIp || pveUser !== ciuser;
  }

  const wantsReboot = options?.reboot ?? false;
  const allowStop =
    options?.forceStop === true || (wantsReboot && !inCloudInitGrace && !isRunning);

  if (inCloudInitGrace && (wantsReboot || configMismatch)) {
    console.warn(
      `[proxmox] ${vps.hostname} skip stop/reboot — cloud-init grace (${uptimeSec}s uptime)`,
    );
  }

  if (useStaticIp) {
    if (allowStop) {
      try {
        await client.stopVm(node, vmid);
      } catch {
        /* may already be stopped */
      }
    } else if (isRunning && (wantsReboot || configMismatch)) {
      console.log(
        `[proxmox] ${vps.hostname} config push skipped stop — VM running (uptime ${uptimeSec}s)`,
      );
      return { ip: primaryIp, ciuser };
    }

    await client.configureVm({
      vmid,
      node,
      hostname: vps.hostname,
      cores: vps.cpuCores,
      memoryMb: vps.ramMb,
      diskGb: vps.diskGb,
      templateVmid: 0,
      primaryIp,
      gateway: config.gateway ?? getProxmoxGateway(),
      ipCidr: config.ipCidr,
      rootPassword: password,
      ciuser,
      storage: config.storage,
      bridge: config.bridge,
    });

    await client.ensureCloudInitDrive(node, vmid, config.storage);
    await client.regenerateCloudInit(node, vmid);

    const stillRunning = (await client.getVmStatus(node, vmid).catch(() => ({ status: "" })))
      .status === "running";
    if (!stillRunning) {
      await client.startVm(node, vmid);
    }

    const agentUp = await client.pingGuestAgent(node, vmid);
    if (!agentUp) {
      console.warn(
        `[proxmox] ${vps.hostname} guest-agent down after boot — cloud-init may still be applying network`,
      );
    }

    if (options?.waitForGuest === true) {
      const guestIp = await client.waitForGuestIp(node, vmid, 90_000).catch(() => null);
      if (guestIp && guestIp !== primaryIp) {
        console.warn(
          `[proxmox] ${vps.hostname} guest IP ${guestIp} != billing ${primaryIp} — cloud-init may still be applying`,
        );
      } else if (guestIp && guestIp === primaryIp) {
        await prisma.vpsInstance.update({
          where: { id: vpsId },
          data: { primaryIp: guestIp },
        });
      }
    }
  } else {
    await client.updateVmCloudInitCredentials(node, vmid, password, ciuser);
    if (allowStop) {
      try {
        await client.stopVm(node, vmid);
      } catch {
        /* ignore */
      }
      await client.startVm(node, vmid);
    }
  }

  console.log(
    `[proxmox] access synced ${vps.hostname} vmid=${vmid} user=${ciuser} ip=${primaryIp ?? "dhcp"}`,
  );
  return { ip: primaryIp, ciuser };
}
