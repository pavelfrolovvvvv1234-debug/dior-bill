import { prisma, type Prisma } from "@dior/database";

export interface AuditParams {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    },
  });
}

export async function getAuditLogs(options: {
  actorId?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const where = {
    ...(options.actorId && { actorId: options.actorId }),
    ...(options.entityType && { entityType: options.entityType }),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, email: true, displayName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
