import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { createInvoiceInEngine } from "../core/billing/invoice-engine";
import { createSubscription } from "../core/billing/subscriptions";
import { updateServiceRenewalDates } from "../core/provisioning/engine";
import { withIdempotency } from "../core/events/idempotency";
import { encodeInvoiceBillingAction, parseInvoiceBillingAction } from "./invoice-actions";

const RENEWABLE_STATUSES = new Set(["ACTIVE", "SUSPENDED", "EXPIRED"]);

export async function createUserRenewalInvoice(userId: string, serviceId: string) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, userId },
  });
  if (!service) throw new NotFoundError("Service not found");
  if (!RENEWABLE_STATUSES.has(service.status)) {
    throw new ValidationError("This service cannot be renewed in its current state");
  }

  const openRenewal = await prisma.invoiceItem.findFirst({
    where: {
      serviceId,
      description: { startsWith: "Renewal:" },
      invoice: {
        userId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
    },
    include: { invoice: true },
    orderBy: { invoice: { createdAt: "desc" } },
  });
  if (openRenewal?.invoice) {
    return { invoiceId: openRenewal.invoice.id, existing: true as const };
  }

  const price = Number(service.monthlyPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new ValidationError("Service has no renewal price configured");
  }

  const invoice = await createInvoiceInEngine({
    userId,
    items: [
      {
        description: `Renewal: ${service.label} (1 month)`,
        unitPrice: price,
        serviceId: service.id,
      },
    ],
    notes: encodeInvoiceBillingAction({ type: "renewal", serviceId: service.id }),
    dueInDays: 7,
    idempotencyKey: `user-renew:${serviceId}:${new Date().toISOString().slice(0, 7)}`,
  });

  return { invoiceId: invoice.id, existing: false as const };
}

export async function applyRenewalAfterPayment(params: {
  serviceId: string;
  invoiceId: string;
  idempotencyKey: string;
}): Promise<void> {
  const service = await prisma.service.findUnique({ where: { id: params.serviceId } });
  if (!service) return;

  const renewsAt = new Date(service.renewsAt ?? Date.now());
  if (renewsAt.getTime() < Date.now()) {
    renewsAt.setTime(Date.now());
  }
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  await updateServiceRenewalDates({
    serviceId: params.serviceId,
    renewsAt,
    expiresAt: renewsAt,
    idempotencyKey: params.idempotencyKey,
  });

  const sub = await prisma.subscription.findUnique({ where: { serviceId: params.serviceId } });
  if (sub) {
    await prisma.subscription.update({
      where: { serviceId: params.serviceId },
      data: { nextRenewAt: renewsAt, status: "active", graceUntil: null },
    });
  } else {
    await createSubscription({
      serviceId: params.serviceId,
      nextRenewAt: renewsAt,
      idempotencyKey: `renew:sub:${params.serviceId}:${params.invoiceId}`,
    });
  }

  if (service.status === "SUSPENDED" || service.status === "EXPIRED") {
    const { transitionServiceLifecycle } = await import("../core/provisioning/engine");
    await transitionServiceLifecycle({
      serviceId: params.serviceId,
      to: "ACTIVE",
      reason: "Renewal paid",
      idempotencyKey: `renew:activate:${params.invoiceId}`,
    });
  }
}

export async function resolveInvoiceBillingSideEffects(invoiceId: string, eventId: string): Promise<void> {
  await withIdempotency("invoice.billing_side_effect", invoiceId, async () => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice || invoice.status !== "PAID") return;

    const action = parseInvoiceBillingAction(invoice.notes);
    if (!action) return;

    if (action.type === "renewal") {
      await applyRenewalAfterPayment({
        serviceId: action.serviceId,
        invoiceId,
        idempotencyKey: `renew:paid:${invoiceId}:${eventId}`,
      });
      return;
    }

    if (action.type === "upgrade") {
      const { applyVpsUpgradeAfterPayment } = await import("../servers/vps-upgrade");
      await applyVpsUpgradeAfterPayment({
        userId: invoice.userId,
        vpsId: action.vpsId,
        plan: {
          cpuCores: action.cpuCores,
          ramMb: action.ramMb,
          diskGb: action.diskGb,
          monthlyPrice: action.monthlyPrice,
          planLabel: action.planLabel,
        },
        invoiceId,
        idempotencyKey: `upgrade:paid:${invoiceId}`,
      });
    }
  });
}
