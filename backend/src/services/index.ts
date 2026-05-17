import { prisma, type ServiceType, type ServiceStatus } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { resumeStuckVpsProvisioningForUser } from "../core/provisioning/engine";

export async function getUserServices(
  userId: string,
  type?: ServiceType,
  status?: ServiceStatus,
) {
  await resumeStuckVpsProvisioningForUser(userId);

  return prisma.service.findMany({
    where: {
      userId,
      ...(type && { type }),
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      vpsInstance: { include: { node: true, location: true } },
      dedicatedServer: { include: { location: true, inventory: true } },
      domain: true,
      cdnZone: true,
    },
  });
}

export async function getServiceById(serviceId: string, userId?: string) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, ...(userId && { userId }) },
    include: {
      vpsInstance: { include: { node: true, location: true } },
      dedicatedServer: { include: { location: true } },
      domain: true,
      cdnZone: { include: { edgeRegions: { include: { location: true } } } },
      provisioningJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!service) throw new NotFoundError("Service not found");
  return service;
}

export async function getActiveServicesSummary(userId: string) {
  const services = await prisma.service.groupBy({
    by: ["type", "status"],
    where: { userId },
    _count: true,
  });
  return services;
}
