import { prisma } from "@dior/database";
import { requirePermission } from "../admin/rbac";

export async function exportBillingCsv(
  actorId: string,
  options: { from?: Date; to?: Date } = {},
) {
  await requirePermission(actorId, "billing.read");

  const from = options.from ?? new Date(Date.now() - 30 * 86400000);
  const to = options.to ?? new Date();

  const [transactions, topUps, invoices] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
    prisma.topUp.findMany({
      where: { createdAt: { gte: from, lte: to }, status: "PAID" },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
  ]);

  const lines = [
    "type,date,email,reference,amount,status",
    ...transactions.map(
      (t) =>
        `transaction,${t.createdAt.toISOString()},${t.user.email ?? ""},${t.id},${Number(t.amount)},${t.type}`,
    ),
    ...topUps.map(
      (t) =>
        `topup,${t.createdAt.toISOString()},${t.user.email ?? ""},${t.referenceCode},${Number(t.netAmount)},${t.status}`,
    ),
    ...invoices.map(
      (i) =>
        `invoice,${i.createdAt.toISOString()},${i.user.email ?? ""},${i.number},${Number(i.total)},${i.status}`,
    ),
  ];

  return lines.join("\n");
}
