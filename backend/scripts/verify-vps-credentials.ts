import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import { validateVpsBillingCredentials } from "../src/servers/vps-access";

loadMonorepoEnv();

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"))?.trim();
  if (!arg) {
    console.error("Usage: pnpm run verify-vps-credentials <hostname|vps-id>");
    process.exit(1);
  }

  const vps = await prisma.vpsInstance.findFirst({
    where: {
      OR: [{ id: arg }, { hostname: arg }, { service: { label: arg } }],
    },
    select: { id: true, hostname: true },
  });
  if (!vps) {
    const recent = await prisma.vpsInstance.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        hostname: true,
        primaryIp: true,
        service: { select: { status: true } },
      },
    });
    console.error(`VPS not found: ${arg}`);
    if (recent.length) {
      console.error("\nRecent VPS in billing DB:");
      for (const r of recent) {
        console.error(
          `  ${r.hostname}  ${r.service.status}  ip=${r.primaryIp ?? "—"}`,
        );
      }
      console.error("\nList all: pnpm run list-vps");
    } else {
      console.error("Database has no VPS records — order one via the panel or check DATABASE_URL.");
    }
    process.exit(1);
  }

  const result = await validateVpsBillingCredentials(vps.id);
  console.log(`VPS: ${result.hostname} (${result.serviceStatus})`);
  console.log("Login:", result.access.username);
  console.log("IP:", result.access.host ?? "—");
  console.log("Password stored:", result.access.hasPassword ? "yes" : "NO");
  console.log("SSH:", result.access.sshCommand ?? "—");
  console.log("VMID:", result.access.proxmoxVmid ?? "—");

  if (result.warnings.length) {
    console.log("\nWarnings:");
    for (const w of result.warnings) console.log("  -", w);
  }

  if (result.errors.length) {
    console.log("\nErrors (cannot login with billing data):");
    for (const e of result.errors) console.log("  -", e);
    process.exit(1);
  }

  console.log("\nOK — billing has valid SSH/RDP credentials for this VPS");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
