import { prisma } from "@dior/database";
import { ADMIN_ROLES, type ServiceLifecycleState } from "@dior/shared";
import { ForbiddenError, NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { appendDomainEvent } from "../events/store";
import { DOMAIN_EVENTS } from "@dior/shared";
import {
  adminForceLifecycleTransition,
  startProvisioning,
} from "../provisioning/engine";
import { emitPaymentConfirmed } from "../billing/engine";
import { enqueueJob } from "../../lib/queue";

async function assertAdmin(actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: actorId } });
  if (!user || !ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new ForbiddenError("Admin access required");
  }
}

export async function adminOverrideLifecycle(params: {
  serviceId: string;
  to: ServiceLifecycleState;
  actorId: string;
  reason: string;
}) {
  await assertAdmin(params.actorId);
  await adminForceLifecycleTransition({
    serviceId: params.serviceId,
    to: params.to,
    actorId: params.actorId,
    reason: params.reason,
    idempotencyKey: `admin:${params.actorId}:${Date.now()}`,
  });
  await createAuditLog({
    actorId: params.actorId,
    action: "admin.lifecycle_override",
    entityType: "service",
    entityId: params.serviceId,
    metadata: { to: params.to, reason: params.reason },
  });
  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.SERVICE_SUSPENDED,
    aggregateType: "service",
    aggregateId: params.serviceId,
    payload: {
      adminOverride: true,
      to: params.to,
      reason: params.reason,
      actorId: params.actorId,
    },
    idempotencyKey: `admin.override:${params.serviceId}:${params.to}:${params.actorId}`,
  });
}

export async function adminRetryProvisioning(params: {
  serviceId: string;
  actorId: string;
}) {
  await assertAdmin(params.actorId);
  const service = await prisma.service.findUnique({
    where: { id: params.serviceId },
    include: { vpsInstance: true },
  });
  if (!service?.vpsInstance) throw new NotFoundError("VPS service not found");

  await createAuditLog({
    actorId: params.actorId,
    action: "admin.provision_retry",
    entityType: "service",
    entityId: params.serviceId,
  });

  return startProvisioning({
    serviceId: params.serviceId,
    idempotencyKey: `admin:retry:${params.serviceId}:${Date.now()}`,
  });
}

export async function adminBillingCorrection(params: {
  userId: string;
  invoiceId: string;
  actorId: string;
  markPaid: boolean;
}) {
  await assertAdmin(params.actorId);
  await createAuditLog({
    actorId: params.actorId,
    action: "admin.billing_correction",
    entityType: "invoice",
    entityId: params.invoiceId,
    metadata: { markPaid: params.markPaid },
  });

  if (params.markPaid) {
    const invoice = await prisma.invoice.findUnique({ where: { id: params.invoiceId } });
    if (!invoice) throw new NotFoundError("Invoice not found");
    await emitPaymentConfirmed({
      userId: params.userId,
      invoiceId: params.invoiceId,
      amount: Number(invoice.total),
      idempotencyKey: `admin:correct:${params.invoiceId}`,
    });
  }
}

export async function adminRecoverService(params: {
  serviceId: string;
  actorId: string;
}) {
  await assertAdmin(params.actorId);
  await enqueueJob("reconciliation.run", { domain: "provisioning_proxmox" });
  await adminRetryProvisioning({ serviceId: params.serviceId, actorId: params.actorId });
}
