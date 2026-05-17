import { NotFoundError } from "@dior/shared";
import { prisma } from "@dior/database";
import { enqueueJob } from "../lib/queue";
import {
  createInvoiceInEngine,
  payInvoiceFromBalanceInEngine,
  markInvoicesOverdueInEngine,
  getUserInvoicesFromEngine,
} from "../core/billing/invoice-engine";
import { createSubscription } from "../core/billing/subscriptions";
import { updateServiceRenewalDates } from "../core/provisioning/engine";

export async function createInvoice(
  params: Parameters<typeof createInvoiceInEngine>[0],
) {
  return createInvoiceInEngine(params);
}

export async function payInvoiceFromBalance(
  invoiceId: string,
  userId: string,
  amount?: number,
) {
  return payInvoiceFromBalanceInEngine(invoiceId, userId, amount);
}

export async function getUserInvoices(
  userId: string,
  status?: Parameters<typeof getUserInvoicesFromEngine>[1],
  page = 1,
  pageSize = 20,
) {
  return getUserInvoicesFromEngine(userId, status, page, pageSize);
}

export async function getUserTransactions(userId: string, page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function processOverdueInvoices() {
  const overdue = await markInvoicesOverdueInEngine();
  for (const invoice of overdue) {
    await enqueueJob("invoice.overdue", { invoiceId: invoice.id, userId: invoice.userId });
  }
  await enqueueJob("billing.unpaid_check", {});
  return overdue.length;
}

export async function renewService(serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { user: true },
  });
  if (!service) throw new NotFoundError("Service not found");

  const invoice = await createInvoiceInEngine({
    userId: service.userId,
    items: [
      {
        description: `Renewal: ${service.label}`,
        unitPrice: Number(service.monthlyPrice),
        serviceId: service.id,
      },
    ],
    idempotencyKey: `renew:${serviceId}:${Date.now()}`,
  });

  if (service.autoRenew && Number(service.user.balance) >= Number(service.monthlyPrice)) {
    await payInvoiceFromBalanceInEngine(invoice.id, service.userId);
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);
    await updateServiceRenewalDates({
      serviceId,
      renewsAt,
      expiresAt: renewsAt,
      idempotencyKey: `renew:dates:${invoice.id}`,
    });
    const sub = await prisma.subscription.findUnique({ where: { serviceId } });
    if (sub) {
      await prisma.subscription.update({
        where: { serviceId },
        data: { nextRenewAt: renewsAt, status: "active", graceUntil: null },
      });
    } else {
      await createSubscription({
        serviceId,
        nextRenewAt: renewsAt,
        idempotencyKey: `renew:sub:${serviceId}`,
      });
    }
  }

  return invoice;
}

export { applyPromoCode, redeemPromoCode, topUpBalance } from "./legacy-helpers";
export { getBillingOverview, type BillingOverviewData } from "./overview";
