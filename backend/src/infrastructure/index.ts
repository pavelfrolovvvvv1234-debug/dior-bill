import { prisma } from "@dior/database";
import { toJsonValue } from "../lib/json";
import { cacheGet, cacheSet } from "../lib/redis";

export async function getInfrastructureFeed(page = 1, pageSize = 20) {
  const cacheKey = `infra:feed:${page}`;
  const cached = await cacheGet<Awaited<ReturnType<typeof prisma.infrastructureFeed.findMany>>>(cacheKey);
  if (cached) {
    const total = await prisma.infrastructureFeed.count({ where: { published: true } });
    return { items: cached, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  const items = await prisma.infrastructureFeed.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  await cacheSet(cacheKey, items, 120);
  const total = await prisma.infrastructureFeed.count({ where: { published: true } });
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function publishFeedItem(params: {
  type: string;
  title: string;
  description: string;
  severity?: string;
  locationId?: string;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
}) {
  const item = await prisma.infrastructureFeed.create({
    data: {
      ...params,
      metadata: toJsonValue(params.metadata),
    },
  });
  return item;
}

export {
  getInfrastructureStatus,
  getLiveMetricsSnapshot,
  type InfraStatusPage,
  type NodeStatusDto,
} from "./status";

export async function getSystemStatus() {
  const [nodes, locations] = await Promise.all([
    prisma.node.groupBy({ by: ["status"], _count: true }),
    prisma.location.count({ where: { active: true } }),
  ]);

  const online = nodes.find((n) => n.status === "online")?._count ?? 0;
  const total = nodes.reduce((s, n) => s + n._count, 0);

  return {
    operational: online === total && total > 0,
    nodes: { online, total },
    locations,
    lastUpdated: new Date().toISOString(),
  };
}
