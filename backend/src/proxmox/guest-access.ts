import { getProxmoxClient } from "./client";
import { getProxmoxConfig } from "./config";
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
  /** Fail provision if agent is up but password sync fails (default true). */
  requirePassword?: boolean;
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

  const agentUp = await client.pingGuestAgent(params.node, params.vmid);
  if (!agentUp) {
    console.warn(
      `[proxmox] vmid=${params.vmid} guest-agent down — cannot finalize login (IP/password)`,
    );
    if (requirePassword) {
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
  if (!networkOk) {
    console.warn(
      `[proxmox] vmid=${params.vmid} guest still missing ${params.primaryIp} after login finalize`,
    );
  } else if (passwordOk) {
    console.log(
      `[proxmox] vmid=${params.vmid} guest login ready: ${params.username}@${params.primaryIp}`,
    );
  }

  return { networkOk, passwordOk };
}
