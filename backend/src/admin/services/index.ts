import { prisma } from "@dior/database";
import type { ServiceStatus, ServiceType } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";

export async function listAdminServices(
  actorId: string,
  options: {
    q?: string;
    type?: ServiceType;
    status?: ServiceStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "services.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const q = options.q?.trim();

  const where = {
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(q && {
      OR: [
        { label: { contains: q } },
        { user: { email: { contains: q } } },
        { id: q.length > 8 ? q : undefined },
      ].filter(Boolean),
    }),
  };

  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, email: true } },
        vpsInstance: {
          select: {
            primaryIp: true,
            hostname: true,
            node: { select: { name: true } },
            location: { select: { code: true, country: true } },
          },
        },
        dedicatedServer: {
          select: { primaryIp: true, hostname: true, ipmiUrl: true },
        },
        domain: { select: { domainName: true, expiresAt: true } },
        cdnZone: { select: { zoneName: true } },
      },
    }),
    prisma.service.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getAdminServiceDetail(actorId: string, serviceId: string) {
  await requirePermission(actorId, "services.read");

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      user: { select: { id: true, email: true, status: true } },
      vpsInstance: { include: { node: true, location: true } },
      dedicatedServer: true,
      domain: true,
      cdnZone: true,
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!service) throw new NotFoundError("Service not found");
  return service;
}

export async function adminUpdateServiceStatus(
  actorId: string,
  serviceId: string,
  status: ServiceStatus,
  reason?: string,
) {
  await requirePermission(actorId, "services.write");

  const before = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!before) throw new NotFoundError();

  const updated = await prisma.service.update({
    where: { id: serviceId },
    data: {
      status,
      ...(status === "SUSPENDED" && { suspendedAt: new Date() }),
    },
  });

  await createAuditLog({
    actorId,
    action: `service.status.${status.toLowerCase()}`,
    entityType: "service",
    entityId: serviceId,
    metadata: { before: before.status, after: status, reason },
  });

  return updated;
}

export async function adminToggleServiceAutoRenew(
  actorId: string,
  serviceId: string,
  autoRenew: boolean,
) {
  await requirePermission(actorId, "billing.write");

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new NotFoundError();

  const updated = await prisma.service.update({
    where: { id: serviceId },
    data: { autoRenew },
  });

  await createAuditLog({
    actorId,
    action: autoRenew ? "service.autorenew.enable" : "service.autorenew.disable",
    entityType: "service",
    entityId: serviceId,
  });

  return updated;
}

export async function adminExtendServiceRenewal(
  actorId: string,
  serviceId: string,
  days: number,
) {
  await requirePermission(actorId, "billing.write");

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new NotFoundError();

  const base = service.renewsAt ?? new Date();
  const renewsAt = new Date(base);
  renewsAt.setDate(renewsAt.getDate() + days);

  const updated = await prisma.service.update({
    where: { id: serviceId },
    data: { renewsAt },
  });

  await createAuditLog({
    actorId,
    action: "service.renewal.extend",
    entityType: "service",
    entityId: serviceId,
    metadata: { days, renewsAt: renewsAt.toISOString() },
  });

  return updated;
}

export async function deleteAdminService(actorId: string, serviceId: string) {
  await requirePermission(actorId, "services.write");

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, label: true, type: true, userId: true, user: { select: { email: true } } },
  });
  if (!service) throw new NotFoundError("Service not found");

  await prisma.service.delete({ where: { id: serviceId } });

  await createAuditLog({
    actorId,
    action: "service.delete",
    entityType: "service",
    entityId: serviceId,
    metadata: {
      label: service.label,
      type: service.type,
      userId: service.userId,
      userEmail: service.user.email,
    },
  });
}
