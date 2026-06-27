import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";

loadMonorepoEnv();

async function main() {
  const filter = process.argv.slice(2).find((a) => !a.startsWith("-"))?.trim();

  const rows = await prisma.vpsInstance.findMany({
    where: filter
      ? {
          OR: [
            { hostname: { contains: filter } },
            { service: { label: { contains: filter } } },
            { primaryIp: { contains: filter } },
          ],
        }
      : undefined,
    include: { service: { select: { status: true, label: true, userId: true } } },
    orderBy: { createdAt: "desc" },
    take: filter ? 20 : 30,
  });

  if (rows.length === 0) {
    console.log(filter ? `No VPS matching "${filter}"` : "No VPS in database.");
    process.exit(filter ? 1 : 0);
  }

  console.log(
    "hostname".padEnd(20),
    "status".padEnd(14),
    "ip".padEnd(16),
    "vmid".padEnd(6),
    "id",
  );
  console.log("-".repeat(80));
  for (const v of rows) {
    console.log(
      v.hostname.padEnd(20),
      v.service.status.padEnd(14),
      (v.primaryIp ?? "—").padEnd(16),
      String(v.proxmoxVmid ?? "—").padEnd(6),
      v.id,
    );
  }
  console.log(`\n${rows.length} row(s). Verify: pnpm run verify-vps-credentials <hostname>`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
