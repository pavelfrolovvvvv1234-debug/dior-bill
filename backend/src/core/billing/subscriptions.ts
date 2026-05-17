import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { appendDomainEvent } from "../events/store";

export type SubscriptionInterval = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "past_due" | "canceled";

/**
 * Billing-owned subscription records.
 */
export async function createSubscription(params: {
  serviceId: string;
  interval?: SubscriptionInterval;
  nextRenewAt: Date;
  idempotencyKey: string;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { serviceId: params.serviceId },
  });
  if (existing) return existing;

  const sub = await prisma.subscription.create({
    data: {
      serviceId: params.serviceId,
      interval: params.interval ?? "monthly",
      status: "active",
      nextRenewAt: params.nextRenewAt,
    },
  });

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.INVOICE_CREATED,
    aggregateType: "service",
    aggregateId: params.serviceId,
    payload: { subscriptionId: sub.id, interval: sub.interval },
    idempotencyKey: `subscription.created:${params.idempotencyKey}`,
  });

  return sub;
}

export async function markSubscriptionPastDue(
  serviceId: string,
  graceUntil: Date,
  idempotencyKey: string,
) {
  return prisma.subscription.update({
    where: { serviceId },
    data: { status: "past_due", graceUntil },
  }).then(async (sub) => {
    await appendDomainEvent({
      eventType: DOMAIN_EVENTS.BILLING_GRACE_PERIOD,
      aggregateType: "service",
      aggregateId: serviceId,
      payload: { graceUntil: graceUntil.toISOString(), subscriptionId: sub.id },
      idempotencyKey: `subscription.grace:${idempotencyKey}`,
    });
    return sub;
  });
}

export async function cancelSubscription(serviceId: string, idempotencyKey: string) {
  return prisma.subscription.update({
    where: { serviceId },
    data: { status: "canceled", canceledAt: new Date() },
  }).then(async (sub) => {
    await appendDomainEvent({
      eventType: DOMAIN_EVENTS.PAYMENT_FAILED,
      aggregateType: "service",
      aggregateId: serviceId,
      payload: { reason: "subscription_canceled", subscriptionId: sub.id },
      idempotencyKey: `subscription.canceled:${idempotencyKey}`,
    });
    return sub;
  });
}
