import { getProxmoxClient } from "./client";

const FIRST_BOOT_MIN_WAIT_MS = 120_000;
const GUEST_IP_POLL_MS = 300_000;
/** Allow ACTIVE without guest-agent if static ipconfig0 + min uptime (cloud-init finished). */
const STATIC_IP_MIN_UPTIME_SEC = 180;

/**
 * Wait for guest network after first start. Never stops/reboots the VM.
 * Ready = guest-agent IP match, or ipconfig0 + firewall=0 + min uptime.
 */
export async function waitForVpsProvisionReady(
  node: string,
  vmid: number,
  expectedIp: string,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return true;

  const started = Date.now();
  const guestIp = await client.waitForGuestIp(node, vmid, GUEST_IP_POLL_MS);
  if (guestIp === expectedIp) {
    console.log(`[proxmox] vmid=${vmid} guest IP confirmed ${expectedIp}`);
    return true;
  }

  const elapsed = Date.now() - started;
  if (elapsed < FIRST_BOOT_MIN_WAIT_MS) {
    await new Promise((r) => setTimeout(r, FIRST_BOOT_MIN_WAIT_MS - elapsed));
  }

  const cfg = await client.getVmConfig(node, vmid);
  const configIp = client.parseIpFromConfig(cfg);
  const net0 = cfg.net0 ?? "";
  if (net0.includes("firewall=1")) {
    console.error(
      `[proxmox] vmid=${vmid} net0 has firewall=1 — SSH blocked at hypervisor (fix net0)`,
    );
    return false;
  }

  if (configIp !== expectedIp) {
    console.warn(
      `[proxmox] vmid=${vmid} ipconfig0 mismatch (expected ${expectedIp}, got ${configIp ?? "none"})`,
    );
    return false;
  }

  const agentUp = await client.pingGuestAgent(node, vmid);
  if (agentUp) {
    const retryIp = await client.waitForGuestIp(node, vmid, 60_000);
    if (retryIp === expectedIp) {
      console.log(`[proxmox] vmid=${vmid} guest IP confirmed on retry ${expectedIp}`);
      return true;
    }
  }

  const uptime = await client.getVmUptimeSec(node, vmid);
  if (uptime >= STATIC_IP_MIN_UPTIME_SEC) {
    console.log(
      `[proxmox] vmid=${vmid} static ipconfig0=${expectedIp} uptime=${uptime}s — provision ready (no guest-agent)`,
    );
    return true;
  }

  console.warn(
    `[proxmox] vmid=${vmid} network not confirmed (expected ${expectedIp}, guest ${guestIp ?? "none"}, uptime ${uptime}s)`,
  );
  return false;
}
