import { createConnection } from "net";
import { getHostVdsSshReadyTimeoutMs, getHostVdsSshSettleMs } from "./config";

function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

/** ACTIVE ≠ SSH ready — wait for TCP/22 after a short settle. */
export async function waitForSshReady(
  ipv4: string,
  opts?: { timeoutMs?: number; settleMs?: number; intervalMs?: number },
): Promise<void> {
  const settleMs = opts?.settleMs ?? getHostVdsSshSettleMs();
  const timeoutMs = opts?.timeoutMs ?? getHostVdsSshReadyTimeoutMs();
  const intervalMs = opts?.intervalMs ?? 3_000;

  if (settleMs > 0) {
    await new Promise((r) => setTimeout(r, settleMs));
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeTcp(ipv4, 22, 2_500)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`SSH (TCP/22) not open on ${ipv4} within ${timeoutMs}ms`);
}
