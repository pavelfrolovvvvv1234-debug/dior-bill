import { prisma } from "@dior/database";
import { requirePermission } from "../rbac";

export async function getInfrastructureOverview(actorId: string) {
  await requirePermission(actorId, "infrastructure.read");

  const [nodes, provisioningJobs, ipPool, dedicatedStock] = await Promise.all([
    prisma.node.findMany({
      include: { location: { select: { code: true, country: true, city: true } } },
      orderBy: { loadPercent: "desc" },
    }),
    prisma.provisioningJob.findMany({
      where: { status: { in: ["queued", "running", "retry", "failed"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        service: { select: { id: true, label: true, type: true, user: { select: { email: true } } } },
      },
    }),
    prisma.ipAddress.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.dedicatedInventory.findMany({
      orderBy: { stockAvail: "desc" },
      take: 20,
    }),
  ]);

  const locationIds = [...new Set(dedicatedStock.map((d) => d.locationId))];
  const locations = await prisma.location.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, code: true, country: true },
  });
  const locMap = Object.fromEntries(locations.map((l) => [l.id, l]));

  return {
    nodes,
    provisioningJobs,
    ipPool: ipPool.map((p) => ({ status: p.status, count: p._count })),
    dedicatedStock: dedicatedStock.map((d) => ({
      ...d,
      location: locMap[d.locationId],
    })),
  };
}
