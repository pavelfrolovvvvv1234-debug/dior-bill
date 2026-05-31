import { prisma } from "@dior/database";
import { NotFoundError, ConflictError } from "@dior/shared";
import { createServiceOrder } from "../core/provisioning/engine";
import { createInvoiceInEngine } from "../core/billing/invoice-engine";
import { createSubscription } from "../core/billing/subscriptions";
import { createHash } from "crypto";

export async function getUserDomains(userId: string) {
  return prisma.domain.findMany({
    where: { service: { userId } },
    include: { service: true },
    orderBy: { expiresAt: "asc" },
  });
}

export async function getDomainById(domainId: string, userId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, service: { userId } },
    include: { service: true },
  });
  if (!domain) throw new NotFoundError("Domain not found");
  return domain;
}

export async function registerDomain(params: {
  userId: string;
  domainName: string;
  price: number;
  years?: number;
}) {
  const existing = await prisma.domain.findUnique({
    where: { domainName: params.domainName },
  });
  if (existing) throw new ConflictError("Domain already registered");

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + (params.years ?? 1));

  const idem = createHash("sha256")
    .update(`domain:${params.userId}:${params.domainName}`)
    .digest("hex")
    .slice(0, 32);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "DOMAIN",
    label: params.domainName,
    monthlyPrice: params.price / 12,
    idempotencyKey: idem,
  });

  await createSubscription({
    serviceId,
    nextRenewAt: expiresAt,
    idempotencyKey: `domain:sub:${idem}`,
  });

  await createInvoiceInEngine({
    userId: params.userId,
    items: [
      {
        description: `Domain registration: ${params.domainName}`,
        unitPrice: params.price,
        serviceId,
      },
    ],
    idempotencyKey: `domain:inv:${idem}`,
  });

  return prisma.domain.create({
    data: {
      serviceId,
      domainName: params.domainName,
      status: "PENDING",
      expiresAt,
      nameservers: ["ns1.dior.cloud", "ns2.dior.cloud"],
    },
    include: { service: true },
  });
}

export async function getExpiringDomains(withinDays = 30) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + withinDays);
  return prisma.domain.findMany({
    where: {
      expiresAt: { lte: threshold, gte: new Date() },
      status: "ACTIVE",
    },
    include: { service: { include: { user: true } } },
  });
}

export {
  getDomainNameservers,
  updateDomainNameservers,
  normalizeNameservers,
  parseNameserversFromDb,
  adminGetDomainNameservers,
  adminUpdateDomainNameservers,
} from "./nameservers";

export {
  searchDomainAvailability,
  searchDomainAvailabilityBulk,
  getLiveTldPrices,
  registerDomainViaAmper,
} from "./amper-service";

export { verifyAmperIntegration, isAmperConfigured } from "../amper";
