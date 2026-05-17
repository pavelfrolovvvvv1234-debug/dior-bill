import { prisma } from "@dior/database";

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "de-fra": { lat: 50.11, lng: 8.68 },
  "nl-ams": { lat: 52.37, lng: 4.9 },
  "us-nyc": { lat: 40.71, lng: -74.01 },
  "tr-ist": { lat: 41.01, lng: 28.98 },
  "fi-hel": { lat: 60.17, lng: 24.94 },
  fra: { lat: 50.11, lng: 8.68 },
  ams: { lat: 52.37, lng: 4.9 },
  hel: { lat: 60.17, lng: 24.94 },
};

export interface NodeStatusDto {
  id: string;
  name: string;
  location: string;
  country: string;
  lat: number;
  lng: number;
  status: string;
  capacityPercent: number;
  ipv4Available: number;
  ipv4Total: number;
  activeVps: number;
}

export interface InfraStatusPage {
  overall: "operational" | "degraded" | "outage";
  uptimePercent: number;
  activeDeployments: number;
  nodes: NodeStatusDto[];
  edgeLocations: Array<{ code: string; name: string; status: string }>;
  updatedAt: string;
}

export async function getInfrastructureStatus(): Promise<InfraStatusPage> {
  const nodes = await prisma.node.findMany({
    include: {
      location: true,
      _count: { select: { vpsInstances: true } },
    },
  });

  const activeJobs = await prisma.provisioningJob.count({
    where: { status: { in: ["queued", "running"] } },
  });

  const locations = await prisma.location.findMany();

  const nodeDtos: NodeStatusDto[] = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    location: n.location.name,
    country: n.location.country,
    lat: LOCATION_COORDS[n.location.code]?.lat ?? 50,
    lng: LOCATION_COORDS[n.location.code]?.lng ?? 10,
    status: n.status,
    capacityPercent: n.capacityPercent,
    ipv4Available: n.ipv4Available,
    ipv4Total: n.ipv4Total,
    activeVps: n._count.vpsInstances,
  }));

  const degraded = nodeDtos.some((n) => n.status !== "online" || n.capacityPercent > 90);
  const outage = nodeDtos.some((n) => n.status === "offline");

  return {
    overall: outage ? "outage" : degraded ? "degraded" : "operational",
    uptimePercent: 99.97,
    activeDeployments: activeJobs,
    nodes: nodeDtos,
    edgeLocations: locations.map((l) => ({
      code: l.code,
      name: l.name,
      status: l.active ? "operational" : "maintenance",
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function getLiveMetricsSnapshot(userId?: string) {
  const where = userId ? { service: { userId } } : {};
  const vpsList = await prisma.vpsInstance.findMany({
    where,
    take: 20,
    select: {
      id: true,
      hostname: true,
      cpuUsage: true,
      ramUsage: true,
      bandwidthUsedGb: true,
      service: { select: { status: true } },
    },
  });

  return {
    vps: vpsList,
    ts: Date.now(),
  };
}
