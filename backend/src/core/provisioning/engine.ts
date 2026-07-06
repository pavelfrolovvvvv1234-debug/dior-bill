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
import { provisionPipelineKey, tryCompleteStuckProvisionedVps } from "../../provisioning/pipeline-guard";
import { notifyAdminsNewService, notifyAdminsProvisioningFailed } from "../../telegram";
import { reportOperationalIssue } from "../../lib/operational-alerts";
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

  if (params.to === "DELETED" || params.to === "CANCELLED") {
    const { teardownVpsNetworkResourcesForService } = await import("../../proxmox/vps-network-teardown");
    await teardownVpsNetworkResourcesForService({
      serviceId: params.serviceId,
      destroyVm: true,
      idempotencyKey: `lifecycle:teardown:${params.serviceId}:${params.idempotencyKey ?? params.to}`,
    }).catch((err) =>
      console.warn(
        "[lifecycle] VPS network teardown:",
        err instanceof Error ? err.message : err,
      ),
    );
  }
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

  const created = await prisma.service.findUnique({
    where: { id: service.id },
    select: { status: true },
  });

  await notifyAdminsNewService({
    serviceId: service.id,
    userId: params.userId,
    label: params.label,
    type: params.type,
    status: created?.status ?? "PENDING",
    monthlyPrice: params.monthlyPrice,
  }).catch((err) => console.warn("[telegram] new service notify:", err));

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

  if (service.status === "PROVISIONING") {
    const job = await prisma.provisioningJob.findFirst({
      where: { serviceId: params.serviceId },
      orderBy: { createdAt: "desc" },
    });
    const vps = service.vpsInstance;
    if (vps && (await tryCompleteStuckProvisionedVps(params.serviceId))) {
      return { jobId: job?.id ?? "", vpsId: vps.id };
    }
    if (job && vps && (job.status === "failed" || job.status === "queued")) {
      await enqueueJob("vps.provision", {
        serviceId: params.serviceId,
        vpsId: vps.id,
        jobId: job.id,
        idempotencyKey: params.idempotencyKey,
      });
    }
    if (job) {
      return { jobId: job.id, vpsId: service.vpsInstance?.id };
    }
    if (vps) {
      const recovered = await initProvisioningJob(params.serviceId, "vps.provision");
      await enqueueJob("vps.provision", {
        serviceId: params.serviceId,
        vpsId: vps.id,
        jobId: recovered.id,
        idempotencyKey: params.idempotencyKey,
      });
      return { jobId: recovered.id, vpsId: vps.id };
    }
  }

  if (service.status !== "PENDING" && service.status !== "FAILED" && service.status !== "ROLLBACK") {
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
    const fresh = await prisma.service.findUnique({
      where: { id: params.serviceId },
      include: { vpsInstance: true },
    });
    if (!fresh) throw new NotFoundError("Service not found");

    if (fresh.status === "ACTIVE") {
      const job = await prisma.provisioningJob.findFirst({
        where: { serviceId: params.serviceId },
        orderBy: { createdAt: "desc" },
      });
      return { jobId: job?.id ?? "", vpsId: fresh.vpsInstance?.id };
    }

    if (await tryCompleteStuckProvisionedVps(params.serviceId)) {
      const job = await prisma.provisioningJob.findFirst({
        where: { serviceId: params.serviceId },
        orderBy: { createdAt: "desc" },
      });
      return { jobId: job?.id ?? "", vpsId: fresh.vpsInstance?.id };
    }

    const runningJob = await prisma.provisioningJob.findFirst({
      where: {
        serviceId: params.serviceId,
        status: "running",
        startedAt: { gt: new Date(Date.now() - 25 * 60 * 1000) },
      },
    });
    if (runningJob && fresh.vpsInstance) {
      return { jobId: runningJob.id, vpsId: fresh.vpsInstance.id };
    }

    if (fresh.status !== "PROVISIONING") {
      if (
        fresh.status !== "PENDING" &&
        fresh.status !== "FAILED" &&
        fresh.status !== "ROLLBACK"
      ) {
        throw new ValidationError(`Cannot provision from status ${fresh.status}`);
      }
      try {
        await transitionServiceLifecycle({
          serviceId: params.serviceId,
          to: "PROVISIONING",
          idempotencyKey: `lifecycle:prov:${params.idempotencyKey}`,
          correlationId: params.correlationId,
        });
      } catch (err) {
        const again = await prisma.service.findUnique({
          where: { id: params.serviceId },
          select: { status: true },
        });
        if (again?.status !== "PROVISIONING") throw err;
      }
    }

    const vps = fresh.vpsInstance;
    if (!vps) throw new ValidationError("VPS record missing for service");

    let job = await prisma.provisioningJob.findFirst({
      where: { serviceId: params.serviceId },
      orderBy: { createdAt: "desc" },
    });
    if (!job) {
      job = await initProvisioningJob(params.serviceId, "vps.provision");
    }

    await prisma.provisioningOperation.upsert({
      where: { idempotencyKey: params.idempotencyKey },
      create: {
        serviceId: params.serviceId,
        operation: "vps.provision",
        idempotencyKey: params.idempotencyKey,
        status: "running",
      },
      update: { status: "running", error: null, completedAt: null },
    });

    const pipelinePayload = {
      serviceId: params.serviceId,
      vpsId: vps.id,
      jobId: job.id,
      idempotencyKey: provisionPipelineKey(params.serviceId),
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
    const service = await prisma.service.findUnique({ where: { id: params.serviceId } });
    if (!service) throw new NotFoundError("Service not found");

    let status = service.status as ServiceLifecycleState;
    if (status !== "PROVISIONING" && status !== "ACTIVE") {
      if (status === "ROLLBACK" || status === "FAILED" || status === "PENDING") {
        await transitionServiceLifecycle({
          serviceId: params.serviceId,
          to: "PROVISIONING",
          reason: "Provision succeeded — normalizing state before activation",
          idempotencyKey: `lifecycle:normalize:${params.idempotencyKey}`,
        });
        status = "PROVISIONING";
      } else if (status !== "REINSTALLING") {
        throw new ValidationError(`Cannot activate service from status ${status}`);
      }
    }

    if (status !== "ACTIVE") {
      await transitionServiceLifecycle({
        serviceId: params.serviceId,
        to: "ACTIVE",
        idempotencyKey: `lifecycle:active:${params.idempotencyKey}`,
      });
    }

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

    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      select: { userId: true, label: true, vpsInstance: { select: { hostname: true } } },
    });
    if (service) {
      await notifyAdminsProvisioningFailed({
        serviceId: params.serviceId,
        userId: service.userId,
        label: service.label,
        error: params.error,
        hostname: service.vpsInstance?.hostname,
      }).catch((err) => console.warn("[telegram] provision failed notify:", err));
    }
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
      status: { in: ["PENDING", "FAILED", "ROLLBACK"] },
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
        idempotencyKey: `resume:${service.id}:${Date.now()}`,
      });
    } catch (err) {
      if (err instanceof ValidationError && String(err.message).includes("Cannot provision")) {
        continue;
      }
      console.error(`[resume-provision] service ${service.id}:`, err);
      await reportOperationalIssue({
        category: "provisioning.resume",
        message: err instanceof Error ? err.message : "Resume failed",
        serviceId: service.id,
        userId,
        dedupeKey: `resume_fail:${service.id}`,
      });
    }
  }

  const stalled = await prisma.service.findMany({
    where: { userId, type: "VPS", status: "PROVISIONING" },
    include: {
      vpsInstance: true,
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const STALL_MS = 15 * 60 * 1000;

  for (const service of stalled) {
    const job = service.provisioningJobs[0];
    const vps = service.vpsInstance;
    if (!job || !vps) continue;

    if (await tryCompleteStuckProvisionedVps(service.id)) continue;

    const jobAge = Date.now() - (job.startedAt ?? job.createdAt).getTime();
    const shouldRetry =
      job.status === "failed" ||
      job.status === "queued" ||
      (job.status === "running" && jobAge > STALL_MS);

    if (!shouldRetry) continue;

    if (job.status === "running" && jobAge > STALL_MS) {
      await prisma.provisioningJob.update({
        where: { id: job.id },
        data: { status: "queued", error: "Re-queued after stall" },
      });
    }

    const idempotencyKey = provisionPipelineKey(service.id);
    try {
      await enqueueJob("vps.provision", {
        serviceId: service.id,
        vpsId: vps.id,
        jobId: job.id,
        idempotencyKey,
      });
    } catch (err) {
      console.error(`[resume-provision] retry job ${job.id}:`, err);
      await reportOperationalIssue({
        category: "provisioning.retry",
        message: err instanceof Error ? err.message : "Re-queue failed",
        serviceId: service.id,
        userId,
        dedupeKey: `retry_fail:${job.id}`,
      });
    }
  }

  const reinstalling = await prisma.service.findMany({
    where: { userId, type: "VPS", status: "REINSTALLING" },
    include: { vpsInstance: true },
  });
  for (const service of reinstalling) {
    const vps = service.vpsInstance;
    if (!vps) continue;
    if (vps.proxmoxVmid) {
      try {
        const { syncVpsIpFromProxmox } = await import("../../proxmox");
        await syncVpsIpFromProxmox(vps.id);
      } catch (err) {
        console.error(`[resume-provision] REINSTALLING ${vps.hostname}:`, err);
      }
      continue;
    }
    try {
      const { retryVpsProvisioningForInstance } = await import("../../provisioning/retry");
      await retryVpsProvisioningForInstance({ hostname: vps.hostname, force: true });
    } catch (err) {
      console.error(`[resume-provision] REINSTALLING retry ${vps.hostname}:`, err);
    }
  }
}

const PENDING_ALERT_MS = 10 * 60 * 1000;

/**
 * Global sweep — run from worker reconciliation and on startup.
 * Fixes VPS stuck after worker outages without requiring the user to open My Services.
 */
export async function resumeAllStuckVpsProvisioning(): Promise<{
  usersProcessed: number;
  findings: string[];
}> {
  const findings: string[] = [];

  const stuckUsers = await prisma.service.findMany({
    where: {
      type: "VPS",
      status: { in: ["PENDING", "FAILED", "ROLLBACK", "PROVISIONING", "REINSTALLING"] },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of stuckUsers) {
    try {
      await resumeStuckVpsProvisioningForUser(userId);
    } catch (err) {
      findings.push(
        `User ${userId}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  const longPending = await prisma.service.findMany({
    where: {
      type: "VPS",
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - PENDING_ALERT_MS) },
    },
    include: { invoiceItems: { include: { invoice: true } } },
    take: 30,
  });

  for (const svc of longPending) {
    const paid = svc.invoiceItems.some((i) => i.invoice.status === "PAID");
    if (!paid) continue;
    findings.push(`Paid VPS ${svc.id} (${svc.label}) still PENDING`);
    await reportOperationalIssue({
      category: "provisioning.stuck",
      message: `Paid but still PENDING after ${Math.round(PENDING_ALERT_MS / 60000)}+ minutes`,
      severity: "critical",
      serviceId: svc.id,
      userId: svc.userId,
      details: { label: svc.label },
      dedupeKey: `stuck_pending:${svc.id}`,
    });
  }

  return { usersProcessed: stuckUsers.length, findings };
}
