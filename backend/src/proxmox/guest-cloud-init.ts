import { getProxmoxClient } from "./client";
import { getProxmoxConfig } from "./config";
import { waitForVpsProvisionReady } from "./provision-ready";

/**
 * Template 902 full-clones copy stale cloud-init state on disk — guest ignores Proxmox ipconfig0.
 * When guest-agent is up, wipe cloud-init cache inside the guest and reboot with a fresh seed.
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

export async function tryGuestCloudInitReset(
  node: string,
  vmid: number,
  primaryIp: string,
  storage: string,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return false;

  console.log(`[proxmox] vmid=${vmid} waiting for guest-agent to run cloud-init clean...`);
  const agentUp = await waitForGuestAgent(node, vmid, 180_000);
  if (!agentUp) {
    console.warn(`[proxmox] vmid=${vmid} guest-agent never responded — cannot clean stale cloud-init`);
    return false;
  }

  const guestIps = await client.getGuestAgentIps(node, vmid);
  console.log(
    `[proxmox] vmid=${vmid} guest-agent up, IPs before clean: ${guestIps.length ? guestIps.join(", ") : "none"}`,
  );

  const cleaned = await client.guestCloudInitClean(node, vmid);
  if (!cleaned) {
    console.warn(`[proxmox] vmid=${vmid} cloud-init clean via guest-agent failed`);
    return false;
  }

  console.log(`[proxmox] vmid=${vmid} cloud-init clean OK — regenerating seed and rebooting`);
  try {
    const st = await client.getVmStatus(node, vmid);
    if (st.status === "running") {
      await client.stopVm(node, vmid);
    }
  } catch {
    /* optional */
  }

  await client.regenerateCloudInit(node, vmid);
  await client.startVm(node, vmid);
  return waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
}

export async function finalizeGuestNetworkAfterBoot(
  node: string,
  vmid: number,
  primaryIp: string,
): Promise<boolean> {
  const config = getProxmoxConfig();
  const storage = config?.storage ?? "storage-lvm";
  let ready = await waitForVpsProvisionReady(node, vmid, primaryIp, { repair: true });
  if (ready) return true;
  return tryGuestCloudInitReset(node, vmid, primaryIp, storage);
}
