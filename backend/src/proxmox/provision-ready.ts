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

const DEFAULT_GUEST_POLL_MS = 45_000;
const REPAIR_GUEST_POLL_MS = 15_000;
const DEFAULT_MIN_UPTIME_SEC = 90;
const REPAIR_MIN_UPTIME_SEC = 60;
const REPAIR_MAX_WAIT_MS = 120_000;

export type ProvisionReadyOptions = {
  /** Shorter waits for fix-vm-network / repair jobs (no guest-agent on template 902). */
  repair?: boolean;
};

/**
 * Wait for guest network after start. Never stops/reboots the VM.
 *
 * Ready when Proxmox has correct ipconfig0 + firewall off + VM up long enough.
 * Guest-agent IP and SSH from the billing host are optional bonuses —
 * billing often cannot reach the client subnet, so SSH probe must NOT block provision.
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
  const maxWaitMs = repair ? REPAIR_MAX_WAIT_MS : guestPollMs + 90_000;

  console.log(
    `[proxmox] vmid=${vmid} waiting for network (ipconfig0=${expectedIp}, guest-agent/SSH optional)`,
  );

  const started = Date.now();

  // Best-effort guest-agent poll — never required.
  const guestIp = await client.waitForGuestIp(node, vmid, guestPollMs).catch(() => null);
  if (guestIp === expectedIp) {
    const sshOpen = await tcpProbe(expectedIp, 22, 4000).catch(() => false);
    console.log(
      `[proxmox] vmid=${vmid} guest-agent IP ${expectedIp}` +
        (sshOpen ? " + SSH open from billing" : " (SSH not reachable from billing — OK)"),
    );
    return true;
  }

  while (Date.now() - started < maxWaitMs) {
    try {
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
        const status = await client.getVmStatus(node, vmid).catch(() => ({ status: "unknown" }));
        const uptime = await client.getVmUptimeSec(node, vmid);
        if (status.status === "running" && uptime >= minUptimeSec) {
          const sshOpen = await tcpProbe(expectedIp, 22, 3000).catch(() => false);
          console.log(
            `[proxmox] vmid=${vmid} ready: ipconfig0=${expectedIp} uptime=${uptime}s` +
              ` guest-agent=${guestIp ? "ok" : "down"}` +
              ` ssh_from_billing=${sshOpen ? "open" : "unreachable (ignored)"}`,
          );
          return true;
        }
        console.warn(
          `[proxmox] vmid=${vmid} ipconfig0 OK (${expectedIp}) power=${status.status} uptime=${uptime}s / ${minUptimeSec}s`,
        );
      }
    } catch (e) {
      console.warn(
        `[proxmox] vmid=${vmid} ready-check:`,
        e instanceof Error ? e.message.slice(0, 120) : e,
      );
    }

    await new Promise((r) => setTimeout(r, 12_000));
  }

  // Last chance: if hypervisor config is correct and VM is running, succeed anyway.
  try {
    const cfg = await client.getVmConfig(node, vmid);
    const configIp = client.parseIpFromConfig(cfg);
    const net0 = cfg.net0 ?? "";
    const status = await client.getVmStatus(node, vmid).catch(() => ({ status: "unknown" }));
    if (
      configIp === expectedIp &&
      !net0.includes("firewall=1") &&
      status.status === "running"
    ) {
      console.warn(
        `[proxmox] vmid=${vmid} accepting as ready after timeout — ipconfig0 OK, VM running (SSH/agent not required)`,
      );
      return true;
    }
  } catch {
    /* fall through */
  }

  console.warn(
    `[proxmox] vmid=${vmid} network not confirmed after ${Math.round(maxWaitMs / 1000)}s (expected ${expectedIp})`,
  );
  return false;
}
