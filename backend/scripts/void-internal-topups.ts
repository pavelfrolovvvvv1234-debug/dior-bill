/**
 * Void internal/test top-ups so they don't count in admin statistics.
 *
 * Usage (prod):
 *   cd /var/www/dior-billing/backend
 *   pnpm exec tsx scripts/void-internal-topups.ts
 *   pnpm exec tsx scripts/void-internal-topups.ts --dry-run
 *   pnpm exec tsx scripts/void-internal-topups.ts --username diorhost --amounts 249,639,50
 */
import { loadMonorepoEnv } from "../src/lib/load-env";
import { prisma } from "@dior/database";
import {
  getStatsExcludedTelegramUsernames,
  isStatsExcludedTelegramUsername,
} from "../src/lib/stats-exclusions";
import { voidPaidTopUp } from "../src/payments/topup/void-paid";

loadMonorepoEnv();

function parseAmounts(raw: string | undefined): number[] {
  if (!raw?.trim()) return [249, 639, 50];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const usernameArg = process.argv.find((a) => a.startsWith("--username="))?.split("=")[1];
  const amountsArg = process.argv.find((a) => a.startsWith("--amounts="))?.split("=")[1];

  const username = (usernameArg ?? getStatsExcludedTelegramUsernames()[0] ?? "diorhost")
    .replace(/^@/, "")
    .toLowerCase();
  const amounts = parseAmounts(amountsArg);

  const user = await prisma.user.findFirst({
    where: { telegramUsername: { equals: username, mode: "insensitive" } },
    select: { id: true, telegramUsername: true, email: true, balance: true },
  });

  if (!user) {
    console.error(`User @${username} not found`);
    process.exit(1);
  }

  if (!isStatsExcludedTelegramUsername(user.telegramUsername)) {
    console.warn(
      `Warning: @${user.telegramUsername} is not in STATS_EXCLUDED_TELEGRAM_USERNAMES — continuing anyway`,
    );
  }

  console.log(`User: @${user.telegramUsername ?? username} (${user.id})`);
  console.log(`Balance: $${Number(user.balance).toFixed(2)}`);
  console.log(`Target amounts: ${amounts.map((a) => `$${a}`).join(", ")}`);
  console.log(dryRun ? "DRY RUN — no changes\n" : "Voiding top-ups…\n");

  const paid = await prisma.topUp.findMany({
    where: {
      userId: user.id,
      status: "PAID",
      provider: "HELEKET",
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      referenceCode: true,
      amount: true,
      netAmount: true,
      paidAt: true,
      status: true,
    },
  });

  const picked: typeof paid = [];
  for (const target of amounts) {
    const match = paid.find(
      (row) =>
        !picked.some((p) => p.id === row.id) &&
        Math.abs(Number(row.amount) - target) < 0.01,
    );
    if (match) picked.push(match);
    else console.warn(`No PAID Heleket top-up found for $${target}`);
  }

  if (picked.length === 0) {
    console.log("Nothing to void.");
    process.exit(0);
  }

  for (const topUp of picked) {
    const line = `${topUp.referenceCode} · $${Number(topUp.amount).toFixed(2)} · paid ${topUp.paidAt?.toISOString() ?? "?"}`;
    if (dryRun) {
      console.log(`[dry-run] would void ${line}`);
      continue;
    }

    await voidPaidTopUp(topUp.id, {
      reason: "Internal account — excluded from statistics",
    });
    console.log(`voided ${line}`);
  }

  const after = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });
  console.log(`\nDone. New balance: $${Number(after?.balance ?? 0).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
