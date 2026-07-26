/**
 * Fail stuck HostVDS provisions that never reached ACTIVE (e.g. old allow_all errors).
 *
 * Usage (prod):
 *   cd /var/www/dior-billing/backend
 *   pnpm exec tsx scripts/fail-stuck-hostvds.ts
 *   pnpm exec tsx scripts/fail-stuck-hostvds.ts --apply
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
loadMonorepoEnv();

import { prisma } from "@dior/database";
import { creditWallet } from "../src/payments/wallet";
import { hostVdsDeleteServer } from "../src/hostvds/servers";
import { resolveHostVdsRegionForVps } from "../src/hostvds/provision";
import { markProvisioningFailed } from "../src/core/provisioning/engine";

const APPLY = process.argv.includes("--apply");
const STUCK_MS = 15 * 60 * 1000;

async function refundIfNeeded(serviceId: string, userId: string, monthlyPrice: unknown) {
  const refundDescription = `Refund: Standard VPS ${serviceId}`;
  const already = await prisma.transaction.findFirst({
    where: { userId, type: "CREDIT", description: refundDescription },
  });
  if (already) return false;

  const paid = await prisma.invoiceItem.findFirst({
    where: { serviceId, invoice: { userId, status: "PAID" } },
    include: { invoice: true },
    orderBy: { invoice: { paidAt: "desc" } },
  });
  const amount = paid ? Number(paid.total) : Number(monthlyPrice);
  if (!(amount > 0)) return false;

  await creditWallet({
    userId,
    amount,
    description: refundDescription,
    metadata: { serviceId, reason: "stuck_hostvds_cleanup" },
  });
  return true;
}

async function main() {
  const cutoff = new Date(Date.now() - STUCK_MS);
  const rows = await prisma.vpsInstance.findMany({
    where: {
      provider: "hostvds",
      service: { status: { in: ["PENDING", "PROVISIONING", "ROLLBACK"] } },
      createdAt: { lt: cutoff },
    },
    include: {
      service: true,
      location: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`found ${rows.length} stuck hostvds vps (older than ${STUCK_MS / 60000}m)`);
  if (!rows.length) {
    await prisma.$disconnect();
    return;
  }

  for (const vps of rows) {
    const region = resolveHostVdsRegionForVps(vps);
    console.log(
      `- ${vps.hostname} service=${vps.serviceId} status=${vps.service.status} loc=${vps.location.code} region=${region} external=${vps.externalId ?? "-"}`,
    );
    if (!APPLY) continue;

    if (vps.externalId) {
      await hostVdsDeleteServer(vps.externalId, { region }).catch((e) =>
        console.warn("  delete orphan failed:", e instanceof Error ? e.message : e),
      );
      await prisma.vpsInstance.update({
        where: { id: vps.id },
        data: { externalId: null, primaryIp: null },
      });
    }

    await refundIfNeeded(vps.serviceId, vps.service.userId, vps.service.monthlyPrice)
      .then((did) => console.log(did ? "  refunded" : "  refund skipped"))
      .catch((e) => console.warn("  refund failed:", e));

    await markProvisioningFailed({
      serviceId: vps.serviceId,
      idempotencyKey: `stuck-cleanup:${vps.serviceId}`,
      error: "Stuck HostVDS provision cleaned up (security group / timeout)",
      rollback: true,
    }).catch((e) => console.warn("  mark failed:", e));

    await prisma.provisioningJob.updateMany({
      where: {
        serviceId: vps.serviceId,
        status: { in: ["queued", "running", "pending"] },
      },
      data: { status: "failed", error: "stuck cleanup" },
    });
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to refund + mark failed.");
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
