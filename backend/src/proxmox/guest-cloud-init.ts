import { getProxmoxClient } from "./client";
import { getProxmoxConfig } from "./config";
import { getProxmoxGateway } from "./ip-pool";
import { waitForVpsProvisionReady } from "./provision-ready";

/**
 * Template 902 clones often ignore Proxmox configdrive — recover via guest-agent:
 * clean → regenerate → cloud-init modules → manual IP inject if still no route.
 */
export async function waitForGuestAgent(
  node: string,
  vmid: number,
  timeoutMs = 180_000,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await client.pingGuestAgent(node, vmid)) return true;
    await new Promise((r) => setTimeout(r, 5000));
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

  console.log(`[proxmox] vmid=${vmid} waiting for guest-agent...`);
  const agentUp = await waitForGuestAgent(node, vmid, 180_000);
  if (!agentUp) {
    console.warn(`[proxmox] vmid=${vmid} guest-agent never responded`);
    return false;
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
      await waitForGuestAgent(node, vmid, 120_000);
    }
  }

  if (await client.guestForceCloudInitRun(node, vmid)) {
    const ready = await waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
    if (ready) return true;
  }

  const guestIpsMid = await client.getGuestAgentIps(node, vmid);
  if (guestIpsMid.includes(primaryIp)) {
    return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  }

  console.warn(
    `[proxmox] vmid=${vmid} cloud-init did not apply ${primaryIp} — injecting static network via guest-agent`,
  );
  if (!(await client.guestInjectStaticNetwork(node, vmid, primaryIp, gw, cidr))) {
    return false;
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
