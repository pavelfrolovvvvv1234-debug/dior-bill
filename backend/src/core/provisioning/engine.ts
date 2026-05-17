import { prisma, type ServiceStatus, type ServiceType } from "@dior/database";
import {
  DOMAIN_EVENTS,
  assertTransition,
  type ServiceLifecycleState,
} from "@dior/shared";
import { ValidationError, NotFoundError } from "@dior/shared";
import { appendDomainEvent } from "../events/store";
import { enqueueJob } from "../../lib/queue";
import { initProvisioningJob } from "../../provisioning/state-machine";
import { releaseStuckAbuseRestrictions } from "../abuse/engine";

/**
 * ProvisioningEngine — SOLE owner of Service lifecycle state.
 * All transitions are atomic + emit domain events.
 */
export async function transitionServiceLifecycle(params: {
  serviceId: string;
  to: ServiceLifecycleState;
  reason?: string;
  actorId?: string;
  idempotencyKey?: string;
  correlationId?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: params.serviceId } });
    if (!service) throw new NotFoundError("Service not found");

    const from = service.status as ServiceLifecycleState;
    assertTransition(from, params.to);

    const updated = await tx.service.updateMany({
      where: { id: params.serviceId, version: service.version },
      data: {
        status: params.to as ServiceStatus,
        version: { increment: 1 },
        ...(params.to === "SUSPENDED" && { suspendedAt: new Date() }),
        ...(params.to === "ACTIVE" && { suspendedAt: null }),
      },
    });

    if (updated.count === 0) {
      throw new ValidationError("Concurrent lifecycle update — retry");
    }
  });

  const eventType = lifecycleToEventType(params.to);
  await appendDomainEvent({
    eventType,
    aggregateType: "service",
    aggregateId: params.serviceId,
    payload: { to: params.to, reason: params.reason, actorId: params.actorId },
    idempotencyKey: params.idempotencyKey ?? `lifecycle:${params.serviceId}:${params.to}`,
    correlationId: params.correlationId,
  });
}

function lifecycleToEventType(to: ServiceLifecycleState) {
  const map: Partial<Record<ServiceLifecycleState, (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS]>> = {
    PROVISIONING: DOMAIN_EVENTS.SERVICE_PROVISIONING_STARTED,
    ACTIVE: DOMAIN_EVENTS.SERVICE_PROVISIONED,
    SUSPENDED: DOMAIN_EVENTS.SERVICE_SUSPENDED,
    FAILED: DOMAIN_EVENTS.SERVICE_FAILED,
    DELETED: DOMAIN_EVENTS.SERVICE_DELETED,
    CANCELLED: DOMAIN_EVENTS.SERVICE_DELETED,
    ROLLBACK: DOMAIN_EVENTS.SERVICE_ROLLBACK_STARTED,
    REINSTALLING: DOMAIN_EVENTS.SERVICE_REINSTALLING,
    SNAPSHOTTING: DOMAIN_EVENTS.SERVICE_SNAPSHOTTING,
  };
  return map[to] ?? DOMAIN_EVENTS.SERVICE_CREATED;
}

export async function updateServiceRenewalDates(params: {
  serviceId: string;
  renewsAt: Date;
  expiresAt: Date;
  idempotencyKey: string;
}): Promise<void> {
  await prisma.service.updateMany({
    where: { id: params.serviceId },
    data: { renewsAt: params.renewsAt, expiresAt: params.expiresAt },
  });
  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.SERVICE_PROVISIONED,
    aggregateType: "service",
    aggregateId: params.serviceId,
    payload: {
      action: "renewal_extended",
      renewsAt: params.renewsAt.toISOString(),
    },
    idempotencyKey: `service.renewal:${params.idempotencyKey}`,
  });
}

export async function createServiceOrder(params: {
  userId: string;
  type: ServiceType;
  label: string;
  monthlyPrice: number;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  /** Non-VPS: activate immediately after order (still via FSM) */
  activateImmediately?: boolean;
}): Promise<{ serviceId: string }> {
  await releaseStuckAbuseRestrictions(params.userId);

  const existing = await prisma.domainEvent.findUnique({
    where: { idempotencyKey: `service.created:${params.idempotencyKey}` },
  });
  if (existing) {
    return { serviceId: existing.aggregateId };
  }

  const service = await prisma.service.create({
    data: {
      userId: params.userId,
      type: params.type,
      status: "PENDING",
      label: params.label,
      monthlyPrice: params.monthlyPrice,
    },
  });

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.SERVICE_CREATED,
    aggregateType: "service",
    aggregateId: service.id,
    userId: params.userId,
    payload: { label: params.label, type: params.type, ...params.metadata },
    idempotencyKey: `service.created:${params.idempotencyKey}`,
  });

  if (params.activateImmediately && params.type !== "VPS") {
    await transitionServiceLifecycle({
      serviceId: service.id,
      to: "ACTIVE",
      idempotencyKey: `lifecycle:immediate:${params.idempotencyKey}`,
    });
  }

  return { serviceId: service.id };
}

/** Admin-only forced transition (must emit audit via caller). */
export async function adminForceLifecycleTransition(params: {
  serviceId: string;
  to: ServiceLifecycleState;
  actorId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<void> {
  await transitionServiceLifecycle({
    serviceId: params.serviceId,
    to: params.to,
    reason: params.reason,
    actorId: params.actorId,
    idempotencyKey: `admin:${params.idempotencyKey}`,
  });
}

export async function startProvisioning(params: {
  serviceId: string;
  idempotencyKey: string;
  correlationId?: string;
}): Promise<{ jobId: string; vpsId?: string }> {
  const service = await prisma.service.findUnique({
    where: { id: params.serviceId },
    include: { vpsInstance: true },
  });
  if (!service) throw new NotFoundError("Service not found");
  if (service.status !== "PENDING" && service.status !== "FAILED") {
    const existing = await prisma.provisioningOperation.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing?.status === "completed") {
      const job = await prisma.provisioningJob.findFirst({
        where: { serviceId: params.serviceId },
        orderBy: { createdAt: "desc" },
      });
      return { jobId: job?.id ?? "", vpsId: service.vpsInstance?.id };
    }
    throw new ValidationError(`Cannot provision from status ${service.status}`);
  }

  return withProvisioningIdempotency(params.idempotencyKey, async () => {
    await transitionServiceLifecycle({
      serviceId: params.serviceId,
      to: "PROVISIONING",
      idempotencyKey: `lifecycle:prov:${params.idempotencyKey}`,
      correlationId: params.correlationId,
    });

    const vps = service.vpsInstance;
    if (!vps) throw new ValidationError("VPS record missing for service");

    const job = await initProvisioningJob(params.serviceId, "vps.provision");

    await prisma.provisioningOperation.create({
      data: {
        serviceId: params.serviceId,
        operation: "vps.provision",
        idempotencyKey: params.idempotencyKey,
        status: "running",
      },
    });

    const pipelinePayload = {
      serviceId: params.serviceId,
      vpsId: vps.id,
      jobId: job.id,
      idempotencyKey: params.idempotencyKey,
    };

    await enqueueJob("vps.provision", pipelinePayload);

    return { jobId: job.id, vpsId: vps.id };
  });
}

export async function markProvisioningComplete(params: {
  serviceId: string;
  idempotencyKey: string;
  ip?: string;
  vmid?: number;
}): Promise<void> {
  await withProvisioningIdempotency(`complete:${params.idempotencyKey}`, async () => {
    await transitionServiceLifecycle({
      serviceId: params.serviceId,
      to: "ACTIVE",
      idempotencyKey: `lifecycle:active:${params.idempotencyKey}`,
    });

    await prisma.provisioningOperation.updateMany({
      where: { idempotencyKey: params.idempotencyKey },
      data: { status: "completed", completedAt: new Date() },
    });
  });
}

export async function markProvisioningFailed(params: {
  serviceId: string;
  idempotencyKey: string;
  error: string;
  rollback?: boolean;
}): Promise<void> {
  await withProvisioningIdempotency(`failed:${params.idempotencyKey}`, async () => {
    const to = params.rollback ? "ROLLBACK" : "FAILED";
    await transitionServiceLifecycle({
      serviceId: params.serviceId,
      to,
      reason: params.error,
      idempotencyKey: `lifecycle:failed:${params.idempotencyKey}`,
    });

    await prisma.provisioningOperation.updateMany({
      where: { idempotencyKey: params.idempotencyKey },
      data: { status: "failed", error: params.error, completedAt: new Date() },
    });
  });
}

async function withProvisioningIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = await prisma.provisioningOperation.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing?.status === "completed") {
    return { serviceId: existing.serviceId } as T;
  }

  return fn();
}

/**
 * Paid VPS orders that never left PENDING (e.g. Redis/worker was down) — retry provisioning.
 */
export async function resumeStuckVpsProvisioningForUser(userId: string): Promise<void> {
  const stuck = await prisma.service.findMany({
    where: {
      userId,
      type: "VPS",
      status: { in: ["PENDING", "FAILED"] },
    },
    select: { id: true },
  });

  for (const service of stuck) {
    const paid = await prisma.invoiceItem.findFirst({
      where: {
        serviceId: service.id,
        invoice: { userId, status: "PAID" },
      },
    });
    if (!paid) continue;

    try {
      await startProvisioning({
        serviceId: service.id,
        idempotencyKey: `resume:${service.id}`,
      });
    } catch (err) {
      if (err instanceof ValidationError && String(err.message).includes("Cannot provision")) {
        continue;
      }
      console.error(`[resume-provision] service ${service.id}:`, err);
    }
  }

  const stalled = await prisma.service.findMany({
    where: { userId, type: "VPS", status: "PROVISIONING" },
    include: {
      vpsInstance: true,
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  for (const service of stalled) {
    const job = service.provisioningJobs[0];
    const vps = service.vpsInstance;
    if (!job || !vps) continue;
    if (job.status !== "failed" && job.status !== "queued") continue;

    const idempotencyKey = `resume-job:${job.id}`;
    try {
      await enqueueJob("vps.provision", {
        serviceId: service.id,
        vpsId: vps.id,
        jobId: job.id,
        idempotencyKey,
      });
    } catch (err) {
      console.error(`[resume-provision] retry job ${job.id}:`, err);
    }
  }
}
