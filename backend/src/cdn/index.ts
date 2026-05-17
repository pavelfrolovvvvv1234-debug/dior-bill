import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createServiceOrder } from "../core/provisioning/engine";
import { createInvoiceInEngine } from "../core/billing/invoice-engine";
import { createHash } from "crypto";

export async function getUserCdnZones(userId: string) {
  return prisma.cdnZone.findMany({
    where: { service: { userId } },
    include: {
      service: true,
      edgeRegions: { include: { location: true } },
    },
  });
}

export async function getCdnZoneAnalytics(zoneId: string, userId: string) {
  const zone = await prisma.cdnZone.findFirst({
    where: { id: zoneId, service: { userId } },
    include: { edgeRegions: { include: { location: true } } },
  });
  if (!zone) throw new NotFoundError("CDN zone not found");

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toISOString().split("T")[0],
      bandwidth: Math.random() * 50 + 10,
      requests: Math.floor(Math.random() * 1000000 + 100000),
      cacheHit: 85 + Math.random() * 10,
    };
  });

  return {
    zone,
    timeseries: last30Days,
    summary: {
      totalBandwidthGb: zone.bandwidthGb,
      totalRequests: Number(zone.requests),
      cacheHitRatio: zone.cacheHitRatio,
      edgeCount: zone.edgeRegions.length,
    },
  };
}

export async function createCdnZone(params: {
  userId: string;
  zoneName: string;
  price: number;
  locationIds: string[];
}) {
  const idem = createHash("sha256")
    .update(`cdn:${params.userId}:${params.zoneName}`)
    .digest("hex")
    .slice(0, 32);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "CDN",
    label: params.zoneName,
    monthlyPrice: params.price,
    idempotencyKey: idem,
  });

  await createInvoiceInEngine({
    userId: params.userId,
    items: [
      {
        description: `CDN zone: ${params.zoneName}`,
        unitPrice: params.price,
        serviceId,
      },
    ],
    idempotencyKey: `cdn:inv:${idem}`,
  });

  const zone = await prisma.cdnZone.create({
    data: {
      serviceId,
      zoneName: params.zoneName,
      status: "pending",
    },
  });

  for (const locationId of params.locationIds) {
    await prisma.cdnEdgeRegion.create({
      data: { zoneId: zone.id, locationId },
    });
  }

  return prisma.cdnZone.findUnique({
    where: { id: zone.id },
    include: { service: true, edgeRegions: true },
  });
}
