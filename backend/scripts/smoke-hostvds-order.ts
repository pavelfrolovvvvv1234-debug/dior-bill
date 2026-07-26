/**
 * Smoke: buy Standard Lite 1 (HostVDS) for demo user and wait for ACTIVE + SSH.
 * Usage: pnpm exec tsx scripts/smoke-hostvds-order.ts
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
loadMonorepoEnv();

import { prisma } from "@dior/database";
import { provisionVps, getVpsAccessInfo } from "../src/servers";
import { createConnection } from "net";

function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createConnection({ host, port });
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeoutMs);
    s.on("connect", () => done(true));
    s.on("timeout", () => done(false));
    s.on("error", () => done(false));
  });
}

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@dior.cloud" } });
  if (!demo) throw new Error("demo@dior.cloud not found — run pnpm db:seed");

  // Ensure enough balance for Lite 1 ($2)
  if (Number(demo.balance) < 10) {
    await prisma.user.update({
      where: { id: demo.id },
      data: { balance: 100 },
    });
    console.log("topped demo balance to 100");
  }

  const loc =
    (await prisma.location.findFirst({ where: { code: "RU", active: true } })) ??
    (await prisma.location.findFirst({ where: { active: true } }));
  if (!loc) throw new Error("No active location");

  const hostname = `hv-smoke-${Date.now().toString(36).slice(-6)}`;
  console.log("ordering", { hostname, location: loc.code, plan: "std-1", user: demo.email });

  const { vps, serviceId } = await provisionVps({
    userId: demo.id,
    hostname,
    locationId: loc.id,
    plan: {
      cpuCores: 1,
      ramMb: 1024,
      diskGb: 10,
      bandwidthTb: 999,
      price: 2,
    },
    os: "ubuntu-24.04",
    prepaid: true,
    provider: "hostvds",
    planId: "std-1",
    idempotencyKey: `smoke-hostvds-${hostname}`,
  });

  console.log("created", { vpsId: vps.id, serviceId });

  const deadline = Date.now() + 12 * 60_000;
  let status = "PENDING";
  while (Date.now() < deadline) {
    const row = await prisma.vpsInstance.findUnique({
      where: { id: vps.id },
      include: { service: true },
    });
    status = row?.service.status ?? "UNKNOWN";
    const ip = row?.primaryIp;
    const ext = row?.externalId;
    console.log(new Date().toISOString(), { status, ip, externalId: ext ? `${ext.slice(0, 8)}…` : null });
    if (status === "ACTIVE" && ip) {
      const ssh = await probeTcp(ip, 22, 4000);
      console.log("ssh_tcp22=", ssh);
      const access = await getVpsAccessInfo(vps.id, demo.id);
      console.log("access", {
        host: access.host,
        username: access.username,
        hasPassword: Boolean(access.password),
        passwordLen: access.password?.length ?? 0,
        sshCommand: access.sshCommand,
      });
      if (ssh && access.password) {
        console.log("SMOKE_OK", { vpsId: vps.id, ip, login: access.username });
        // print password once for manual SSH check
        console.log("PASSWORD", access.password);
        return;
      }
      if (!ssh) console.log("waiting for SSH...");
    }
    if (status === "FAILED" || status === "ROLLBACK" || status === "CANCELLED") {
      const job = await prisma.provisioningJob.findFirst({
        where: { serviceId },
        orderBy: { createdAt: "desc" },
      });
      console.error("SMOKE_FAIL", { status, jobError: job?.error });
      process.exitCode = 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.error("SMOKE_TIMEOUT status=", status);
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("SMOKE_ERROR", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
