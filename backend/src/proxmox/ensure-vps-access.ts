import { randomBytes } from "node:crypto";
import { prisma } from "@dior/database";
import { decrypt, encrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import { getProxmoxConfig, isProxmoxConfigured, resolveProxmoxCiUser } from "./config";
import { getProxmoxGateway, isPlaceholderIp } from "./ip-pool";

function generateRootPassword(): string {
  return randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
}

/**
 * Push billing IP + login/password to Proxmox cloud-init and reboot if needed.
 * Fixes "ACTIVE in UI but SSH fails" after skip-clone recovery or wrong ciuser.
 */
export async function ensureVpsProxmoxAccess(
  vpsId: string,
  options?: { reboot?: boolean; waitForGuest?: boolean },
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
  const forceReboot = options?.reboot ?? false;

  let needsReboot = forceReboot;
  if (useStaticIp) {
    const cfg = await client.getVmConfig(node, vmid);
    const pveIp = client.parseIpFromConfig(cfg);
    const pveUser = cfg.ciuser?.trim();
    if (!cfg.ipconfig0 || pveIp !== primaryIp || pveUser !== ciuser) {
      needsReboot = true;
    }
  }

  if (useStaticIp) {
    if (needsReboot) {
      try {
        await client.stopVm(node, vmid);
      } catch {
        /* may already be stopped */
      }
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

    await client.startVm(node, vmid);

    if (options?.waitForGuest !== false) {
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
    if (needsReboot) {
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
