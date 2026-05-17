import { prisma } from "@dior/database";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";

export async function listBroadcasts(actorId: string, page = 1, pageSize = 20) {
  await requirePermission(actorId, "notifications.write");

  const take = Math.min(pageSize, 50);
  const [items, total] = await Promise.all([
    prisma.broadcast.findMany({
      skip: (page - 1) * take,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.broadcast.count(),
  ]);

  return { items, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
}

export async function createBroadcast(
  actorId: string,
  data: {
    title: string;
    body: string;
    type?: string;
    sendNow?: boolean;
  },
) {
  await requirePermission(actorId, "notifications.write");

  const broadcast = await prisma.broadcast.create({
    data: {
      title: data.title,
      body: data.body,
      type: data.type ?? "info",
      sentAt: data.sendNow ? new Date() : null,
    },
  });

  await createAuditLog({
    actorId,
    action: "broadcast.create",
    entityType: "broadcast",
    entityId: broadcast.id,
    metadata: { title: data.title, type: data.type },
  });

  return broadcast;
}
