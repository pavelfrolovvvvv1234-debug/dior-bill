import { prisma } from "@dior/database";
import { toJsonValue } from "./lib/json";
import {
  getActivityFeedReadModel,
  getServiceTimelineReadModel,
} from "./core/read-models";

/** UI timeline — prefer CQRS read model, fallback to legacy ServiceEvent */
export async function getServiceTimeline(serviceId: string, limit = 50) {
  const projected = await getServiceTimelineReadModel(serviceId, limit);
  if (projected.length > 0) {
    return projected.map((r) => ({
      id: r.id,
      type: r.eventType,
      title: r.title,
      description: r.description,
      severity: r.severity ?? "info",
      createdAt: r.occurredAt,
    }));
  }

  return prisma.serviceEvent.findMany({
    where: { serviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  }).then((events) =>
    events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      severity: e.severity ?? "info",
      createdAt: e.createdAt,
    })),
  );
}

export async function recordServiceEvent(input: {
  serviceId: string;
  type: string;
  title: string;
  description?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.serviceEvent.create({
    data: {
      serviceId: input.serviceId,
      type: input.type,
      title: input.title,
      description: input.description,
      severity: input.severity ?? "info",
      metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
    },
  });
}

/** Activity feed — READ MODEL first (event-sourced projections) */
export async function getUserActivityFeed(userId: string, limit = 30) {
  const projected = await getActivityFeedReadModel(userId, limit);
  if (projected.length > 0) {
    return projected.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle ?? undefined,
      at: r.occurredAt,
      severity: r.severity,
      link: r.link ?? undefined,
    }));
  }

  const services = await prisma.service.findMany({
    where: { userId },
    select: { id: true },
  });
  const serviceIds = services.map((s) => s.id);
  if (!serviceIds.length) return [];

  const [events, jobs, topUps] = await Promise.all([
    prisma.serviceEvent.findMany({
      where: { serviceId: { in: serviceIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { service: { select: { label: true, type: true } } },
    }),
    prisma.provisioningJob.findMany({
      where: { serviceId: { in: serviceIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { service: { select: { label: true } } },
    }),
    prisma.topUp.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        status: true,
        provider: true,
        createdAt: true,
      },
    }),
  ]);

  type FeedItem = {
    id: string;
    kind: string;
    title: string;
    subtitle?: string;
    at: Date;
    severity?: string;
    link?: string;
  };

  const feed: FeedItem[] = [];

  for (const e of events) {
    feed.push({
      id: `evt-${e.id}`,
      kind: "service",
      title: e.title,
      subtitle: e.service.label,
      at: e.createdAt,
      severity: e.severity,
    });
  }
  for (const j of jobs) {
    feed.push({
      id: `job-${j.id}`,
      kind: "provision",
      title: `${j.type} — ${j.status}`,
      subtitle: j.service.label,
      at: j.createdAt,
      severity: j.status === "failed" ? "error" : "info",
    });
  }
  for (const t of topUps) {
    feed.push({
      id: `topup-${t.id}`,
      kind: "billing",
      title: `Top-up ${t.status}`,
      subtitle: `${t.provider} · $${Number(t.amount).toFixed(2)}`,
      at: t.createdAt,
      link: `/billing/topup/${t.id}`,
    });
  }

  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  return feed.slice(0, limit);
}
