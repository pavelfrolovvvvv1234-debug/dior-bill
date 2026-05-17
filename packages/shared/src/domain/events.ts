/**
 * Domain events — immutable truth source. All state changes emit these.
 */

export const DOMAIN_EVENTS = {
  // Service / provisioning
  SERVICE_CREATED: "service.created",
  SERVICE_PROVISIONING_STARTED: "service.provisioning_started",
  SERVICE_PROVISIONED: "service.provisioned",
  SERVICE_SUSPENDED: "service.suspended",
  SERVICE_DELETED: "service.deleted",
  SERVICE_FAILED: "service.failed",
  SERVICE_ROLLBACK_STARTED: "service.rollback_started",
  SERVICE_REINSTALLING: "service.reinstalling",
  SERVICE_SNAPSHOTTING: "service.snapshotting",

  // Billing
  PAYMENT_CREATED: "payment.created",
  PAYMENT_PENDING_CONFIRMATION: "payment.pending_confirmation",
  PAYMENT_CONFIRMED: "payment.confirmed",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_EXPIRED: "payment.expired",
  INVOICE_CREATED: "invoice.created",
  INVOICE_PAID: "invoice.paid",
  BILLING_GRACE_PERIOD: "billing.grace_period",

  // Infrastructure
  NODE_STATUS_UPDATED: "node.status_updated",
  USAGE_UPDATED: "usage.updated",
  IP_ALLOCATED: "ip.allocated",
  IP_RELEASED: "ip.released",

  // Abuse
  ABUSE_CHALLENGE: "abuse.challenge",
  ABUSE_FROZEN: "abuse.frozen",
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export type AggregateType = "service" | "invoice" | "payment" | "topup" | "node" | "user" | "ip";

export interface DomainEventPayload {
  eventType: DomainEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  userId?: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string;
}
