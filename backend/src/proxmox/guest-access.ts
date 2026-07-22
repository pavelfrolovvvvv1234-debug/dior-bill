import { prisma } from "@dior/database";
import { decrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "./client";
import { getProxmoxConfig, resolveProxmoxCiUser } from "./config";
import { getProxmoxGateway } from "./ip-pool";

function guessGateway(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
}

function isWindowsOs(os?: string): boolean {
  return (os ?? "").toLowerCase().includes("windows");
}

export type GuestLoginReadyResult = {
  networkOk: boolean;
  passwordOk: boolean;
};

/**
 * Make a freshly cloned guest actually usable for SSH/SFTP:
 * 1) ensure billing IP is inside the OS (templates often ignore cloud-init)
 * 2) set root/ciuser password via guest-agent + enable password SSH
 *
 * Call this after the VM is running and before marking the service ACTIVE.
 * Both networkOk and passwordOk are required by default.
 */
export async function ensureGuestLoginReady(params: {
  node: string;
  vmid: number;
  primaryIp: string;
  username: string;
  password: string;
  gateway?: string;
  cidr?: number;
  os?: string;
  /** Fail if password/sshd sync fails (default true). */
  requirePassword?: boolean;
  /** Fail if guest still missing billing IP (default true). */
  requireNetwork?: boolean;
}): Promise<GuestLoginReadyResult> {
  const client = getProxmoxClient();
  if (!client) {
    return { networkOk: true, passwordOk: true };
  }

  if (isWindowsOs(params.os)) {
    console.log(`[proxmox] vmid=${params.vmid} skip Linux login finalize (Windows guest)`);
    return { networkOk: true, passwordOk: true };
  }

  const config = getProxmoxConfig();
  const gw =
    params.gateway ?? config?.gateway ?? getProxmoxGateway() ?? guessGateway(params.primaryIp);
  const cidr = params.cidr ?? config?.ipCidr ?? 24;
  const requirePassword = params.requirePassword !== false;
  const requireNetwork = params.requireNetwork !== false;

  const agentUp = await client.pingGuestAgent(params.node, params.vmid);
  if (!agentUp) {
    console.warn(
      `[proxmox] vmid=${params.vmid} guest-agent down — cannot finalize login (IP/password)`,
    );
    if (requirePassword || requireNetwork) {
      throw new Error(
        `Guest login not ready for vmid=${params.vmid}: qemu-guest-agent is down`,
      );
    }
    return { networkOk: false, passwordOk: false };
  }

  let guestIps = await client.getGuestAgentIps(params.node, params.vmid).catch(() => [] as string[]);
  let networkOk = guestIps.includes(params.primaryIp);

  if (!networkOk) {
    console.warn(
      `[proxmox] vmid=${params.vmid} ensuring guest IP ${params.primaryIp} (have: ${guestIps.join(",") || "none"})`,
    );
    const injected = await client
      .guestInjectStaticNetwork(params.node, params.vmid, params.primaryIp, gw, cidr)
      .catch(() => false);
    if (injected) {
      await new Promise((r) => setTimeout(r, 6_000));
      guestIps = await client.getGuestAgentIps(params.node, params.vmid).catch(() => [] as string[]);
      networkOk = guestIps.includes(params.primaryIp);
    }
  }

  if (!networkOk && requireNetwork) {
    throw new Error(
      `Guest login not ready for vmid=${params.vmid}: guest OS missing IP ${params.primaryIp}`,
    );
  }

  console.log(
    `[proxmox] vmid=${params.vmid} syncing login ${params.username}@${params.primaryIp} (password + sshd)`,
  );
  const passwordOk = await client
    .guestSetUserPassword(params.node, params.vmid, params.username, params.password)
    .catch(() => false);

  if (!passwordOk && requirePassword) {
    throw new Error(
      `Guest login not ready for vmid=${params.vmid}: password/sshd sync failed (user=${params.username})`,
    );
  }

  if (networkOk && passwordOk) {
    console.log(
      `[proxmox] vmid=${params.vmid} guest login ready: ${params.username}@${params.primaryIp}`,
    );
  }

  return { networkOk, passwordOk };
}

/**
 * Load VPS from DB and push billing password (+ IP if needed) into the guest.
 * Used by reset_password, ensure_access jobs, and early provision return paths.
 */
export async function syncGuestPasswordForVps(
  vpsId: string,
  passwordOverride?: string,
): Promise<GuestLoginReadyResult> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true },
  });
  if (!vps?.proxmoxVmid || !vps.primaryIp) {
    throw new Error(`VPS ${vpsId} missing proxmoxVmid or primaryIp`);
  }

  let password = passwordOverride ?? null;
  if (!password) {
    if (!vps.rootPasswordEnc) throw new Error(`VPS ${vpsId} has no rootPasswordEnc`);
    password = decrypt(vps.rootPasswordEnc);
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const config = getProxmoxConfig();

  return ensureGuestLoginReady({
    node,
    vmid: vps.proxmoxVmid,
    primaryIp: vps.primaryIp,
    username: resolveProxmoxCiUser(vps.os),
    password,
    gateway: config?.gateway ?? getProxmoxGateway(),
    cidr: config?.ipCidr,
    os: vps.os,
  });
}
