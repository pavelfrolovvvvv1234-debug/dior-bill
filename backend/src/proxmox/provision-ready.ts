import { createConnection } from "node:net";
import { getProxmoxClient } from "./client";
import { getProxmoxConfig } from "./config";
import { getProxmoxGateway } from "./ip-pool";

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

function guessGateway(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
}

const DEFAULT_GUEST_POLL_MS = 90_000;
const REPAIR_GUEST_POLL_MS = 30_000;
const DEFAULT_MAX_WAIT_MS = 240_000;
const REPAIR_MAX_WAIT_MS = 150_000;

export type ProvisionReadyOptions = {
  /** Shorter waits for fix-vm-network / repair jobs. */
  repair?: boolean;
};

/**
 * Wait until the guest OS actually has the expected IPv4.
 *
 * Hypervisor ipconfig0 alone is NOT enough — template 902 often ignores cloud-init,
 * so SSH times out even when Proxmox config looks perfect.
 *
 * Ready when:
 *  - qemu-guest-agent reports expectedIp, OR
 *  - SSH :22 reachable from billing (rare — different network)
 *
 * If agent is up but has no/wrong IP → inject static network once via guest-agent.
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
  const maxWaitMs = repair ? REPAIR_MAX_WAIT_MS : DEFAULT_MAX_WAIT_MS;
  const config = getProxmoxConfig();
  const gw = config?.gateway ?? getProxmoxGateway() ?? guessGateway(expectedIp);
  const cidr = config?.ipCidr ?? 24;

  console.log(
    `[proxmox] vmid=${vmid} waiting for guest network ${expectedIp} (agent inject if needed)`,
  );

  const started = Date.now();
  let injected = false;

  // Initial soft poll for agent IP
  const earlyIp = await client.waitForGuestIp(node, vmid, guestPollMs).catch(() => null);
  if (earlyIp === expectedIp) {
    const sshOpen = await tcpProbe(expectedIp, 22, 4000).catch(() => false);
    console.log(
      `[proxmox] vmid=${vmid} guest IP ${expectedIp} confirmed` +
        (sshOpen ? " + SSH open" : " (SSH from billing optional)"),
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
          `[proxmox] vmid=${vmid} ipconfig0=${configIp ?? "none"} (want ${expectedIp})`,
        );
      }

      const agentUp = await client.pingGuestAgent(node, vmid);
      const guestIps = agentUp
        ? await client.getGuestAgentIps(node, vmid).catch(() => [] as string[])
        : [];

      if (guestIps.includes(expectedIp)) {
        console.log(
          `[proxmox] vmid=${vmid} ready: guest-agent has ${expectedIp}` +
            ` (uptime=${await client.getVmUptimeSec(node, vmid)}s)`,
        );
        return true;
      }

      const sshOpen = await tcpProbe(expectedIp, 22, 3000).catch(() => false);
      if (sshOpen) {
        console.log(`[proxmox] vmid=${vmid} ready: SSH :22 open on ${expectedIp}`);
        return true;
      }

      if (agentUp && !injected && configIp === expectedIp) {
        console.warn(
          `[proxmox] vmid=${vmid} agent up but no ${expectedIp} (have: ${guestIps.join(",") || "none"}) — injecting static IP`,
        );
        injected = true;
        const ok = await client
          .guestInjectStaticNetwork(node, vmid, expectedIp, gw, cidr)
          .catch(() => false);
        if (ok) {
          await new Promise((r) => setTimeout(r, 8_000));
          const after = await client.getGuestAgentIps(node, vmid).catch(() => [] as string[]);
          if (after.includes(expectedIp)) {
            console.log(`[proxmox] vmid=${vmid} ready after guest inject ${expectedIp}`);
            return true;
          }
        } else {
          console.warn(`[proxmox] vmid=${vmid} guest inject failed — will keep waiting`);
        }
      } else {
        console.warn(
          `[proxmox] vmid=${vmid} waiting… agent=${agentUp ? "up" : "down"}` +
            ` guestIps=${guestIps.join(",") || "none"} ssh=${sshOpen ? "open" : "closed"}`,
        );
      }
    } catch (e) {
      console.warn(
        `[proxmox] vmid=${vmid} ready-check:`,
        e instanceof Error ? e.message.slice(0, 120) : e,
      );
    }

    await new Promise((r) => setTimeout(r, 10_000));
  }

  console.warn(
    `[proxmox] vmid=${vmid} guest still has no ${expectedIp} after ${Math.round(maxWaitMs / 1000)}s` +
      ` — template cloud-init likely broken (need inject/rebuild)`,
  );
  return false;
}
