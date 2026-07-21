import { getProxmoxClient } from "./client";
import { getProxmoxConfig } from "./config";
import { getProxmoxGateway } from "./ip-pool";
import { waitForVpsProvisionReady } from "./provision-ready";

/**
 * Template 902 clones often ignore Proxmox configdrive — recover via guest-agent
 * when available. If qemu-guest-agent is not installed, return false quickly
 * (never throw "QEMU guest agent is not running").
 */
export async function waitForGuestAgent(
  node: string,
  vmid: number,
  timeoutMs = 60_000,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await client.pingGuestAgent(node, vmid)) return true;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return false;
}

function guessGateway(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
}

export async function tryGuestCloudInitReset(
  node: string,
  vmid: number,
  primaryIp: string,
  gateway?: string,
  cidr = 24,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return false;

  const gw = gateway ?? getProxmoxGateway() ?? guessGateway(primaryIp);

  console.log(`[proxmox] vmid=${vmid} guest-agent recovery (optional)...`);
  const agentUp = await waitForGuestAgent(node, vmid, 45_000);
  if (!agentUp) {
    console.warn(
      `[proxmox] vmid=${vmid} guest-agent not available — skip agent recovery (ipconfig0 path only)`,
    );
    return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  }

  const guestIpsBefore = await client.getGuestAgentIps(node, vmid);
  console.log(
    `[proxmox] vmid=${vmid} guest-agent up, IPs: ${guestIpsBefore.length ? guestIpsBefore.join(", ") : "none"}`,
  );

  if (!guestIpsBefore.includes(primaryIp)) {
    const cleaned = await client.guestCloudInitClean(node, vmid);
    if (cleaned) {
      console.log(`[proxmox] vmid=${vmid} cloud-init clean OK — regenerating seed`);
      try {
        const st = await client.getVmStatus(node, vmid);
        if (st.status === "running") await client.stopVm(node, vmid);
      } catch {
        /* optional */
      }
      await client.regenerateCloudInit(node, vmid);
      await client.startVm(node, vmid);
      await waitForGuestAgent(node, vmid, 60_000);
    }
  }

  try {
    if (await client.guestForceCloudInitRun(node, vmid)) {
      const ready = await waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
      if (ready) return true;
    }
  } catch (e) {
    console.warn(
      `[proxmox] vmid=${vmid} cloud-init force skipped:`,
      e instanceof Error ? e.message.slice(0, 120) : e,
    );
  }

  const guestIpsMid = await client.getGuestAgentIps(node, vmid);
  if (guestIpsMid.includes(primaryIp)) {
    return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  }

  console.warn(
    `[proxmox] vmid=${vmid} cloud-init did not apply ${primaryIp} — injecting static network via guest-agent`,
  );
  try {
    if (!(await client.guestInjectStaticNetwork(node, vmid, primaryIp, gw, cidr))) {
      return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
    }
  } catch (e) {
    console.warn(
      `[proxmox] vmid=${vmid} static inject skipped:`,
      e instanceof Error ? e.message.slice(0, 120) : e,
    );
    return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  }

  return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
}

export async function finalizeGuestNetworkAfterBoot(
  node: string,
  vmid: number,
  primaryIp: string,
  gateway?: string,
  cidr?: number,
): Promise<boolean> {
  const config = getProxmoxConfig();
  let ready = await waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  if (ready) return true;
  return tryGuestCloudInitReset(
    node,
    vmid,
    primaryIp,
    gateway,
    cidr ?? config?.ipCidr ?? 24,
  );
}
