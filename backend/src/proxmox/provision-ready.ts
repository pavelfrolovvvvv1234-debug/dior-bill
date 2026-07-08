import { createConnection } from "node:net";
import { getProxmoxClient } from "./client";

async function tcpProbe(host: string, port: number, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

const DEFAULT_GUEST_POLL_MS = 90_000;
const REPAIR_GUEST_POLL_MS = 20_000;
const DEFAULT_MIN_UPTIME_SEC = 180;
const REPAIR_MIN_UPTIME_SEC = 90;
const REPAIR_MAX_WAIT_MS = 180_000;

export type ProvisionReadyOptions = {
  /** Shorter waits for fix-vm-network / repair jobs (no guest-agent on template 902). */
  repair?: boolean;
};

/**
 * Wait for guest network after start. Never stops/reboots the VM.
 * Ready = guest-agent IP, or ipconfig0 + firewall=0 + min uptime.
 */
export async function waitForVpsProvisionReady(
  node: string,
  vmid: number,
  expectedIp: string,
  options?: ProvisionReadyOptions,
): Promise<boolean> {
  const client = getProxmoxClient();
  if (!client) return true;

  const repair = options?.repair === true;
  const guestPollMs = repair ? REPAIR_GUEST_POLL_MS : DEFAULT_GUEST_POLL_MS;
  const minUptimeSec = repair ? REPAIR_MIN_UPTIME_SEC : DEFAULT_MIN_UPTIME_SEC;
  const maxWaitMs = repair ? REPAIR_MAX_WAIT_MS : guestPollMs + 120_000;

  if (repair) {
    console.log(
      `[proxmox] vmid=${vmid} waiting for cloud-init (~${minUptimeSec}s after boot, guest-agent optional)`,
    );
  }

  const started = Date.now();
  const guestIp = await client.waitForGuestIp(node, vmid, guestPollMs);
  if (guestIp === expectedIp) {
    const sshOpen = await tcpProbe(expectedIp, 22, 6000);
    if (sshOpen) {
      console.log(`[proxmox] vmid=${vmid} guest IP confirmed ${expectedIp} + SSH open`);
      return true;
    }
    console.warn(
      `[proxmox] vmid=${vmid} guest IP confirmed ${expectedIp}, but SSH :22 not reachable yet — waiting`,
    );
  }

  while (Date.now() - started < maxWaitMs) {
    const cfg = await client.getVmConfig(node, vmid);
    const configIp = client.parseIpFromConfig(cfg);
    const net0 = cfg.net0 ?? "";

    if (net0.includes("firewall=1")) {
      console.error(`[proxmox] vmid=${vmid} net0 firewall=1 — SSH blocked at hypervisor`);
      return false;
    }

    if (configIp !== expectedIp) {
      console.warn(
        `[proxmox] vmid=${vmid} ipconfig0=${configIp ?? "none"} (want ${expectedIp}) — cloud-init pending`,
      );
    } else {
      const uptime = await client.getVmUptimeSec(node, vmid);
      if (uptime >= minUptimeSec) {
        const sshOpen = await tcpProbe(expectedIp, 22, repair ? 4000 : 6000);
        if (sshOpen) {
          console.log(
            `[proxmox] vmid=${vmid} ready: ipconfig0=${expectedIp} uptime=${uptime}s (guest-agent ${guestIp ? "ok" : "down"}) SSH open`,
          );
          return true;
        }
        console.warn(
          `[proxmox] vmid=${vmid} ipconfig0 OK (${expectedIp}) uptime=${uptime}s, but SSH :22 closed/timeout — keep waiting`,
        );
      }
      if (repair && Date.now() - started > 15_000) {
        console.log(
          `[proxmox] vmid=${vmid} ipconfig0 OK, uptime ${uptime}s / ${minUptimeSec}s — cloud-init applying...`,
        );
      }
    }

    await new Promise((r) => setTimeout(r, 15_000));
  }

  console.warn(
    `[proxmox] vmid=${vmid} network not confirmed after ${Math.round(maxWaitMs / 1000)}s (expected ${expectedIp})`,
  );
  return false;
}
