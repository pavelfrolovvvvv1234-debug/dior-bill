import { prisma } from "@dior/database";

export type CustomerSearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: "service" | "invoice" | "topup";
};

function serviceHref(service: {
  id: string;
  type: string;
  vpsInstance: { id: string } | null;
  domain: { id: string } | null;
}): string {
  if (service.vpsInstance) return `/vps/${service.vpsInstance.id}`;
  if (service.domain) return `/domains/${service.domain.id}`;
  if (service.type === "DEDICATED") return `/services?type=dedicated&id=${service.id}`;
  if (service.type === "CDN") return `/services?type=cdn&id=${service.id}`;
  return `/services`;
}

function serviceTitle(service: {
  label: string;
  type: string;
  vpsInstance: { hostname: string; primaryIp: string | null } | null;
  dedicatedServer: { hostname: string; primaryIp: string | null } | null;
  domain: { domainName: string } | null;
  cdnZone: { zoneName: string } | null;
}): { title: string; subtitle?: string } {
  if (service.vpsInstance) {
    return {
      title: service.vpsInstance.hostname,
      subtitle: service.vpsInstance.primaryIp ?? "VPS / VDS",
    };
  }
  if (service.dedicatedServer) {
    return {
      title: service.dedicatedServer.hostname,
      subtitle: service.dedicatedServer.primaryIp ?? "Dedicated server",
    };
  }
  if (service.domain) {
    return { title: service.domain.domainName, subtitle: "Domain" };
  }
  if (service.cdnZone) {
    return { title: service.cdnZone.zoneName, subtitle: "CDN zone" };
  }
  return { title: service.label, subtitle: service.type };
}

export async function searchCustomerDashboard(
  userId: string,
  query: string,
): Promise<CustomerSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [services, invoices, topUps] = await Promise.all([
    prisma.service.findMany({
      where: {
        userId,
        OR: [
          { label: { contains: q } },
          {
            vpsInstance: {
              is: {
                OR: [{ hostname: { contains: q } }, { primaryIp: { contains: q } }],
              },
            },
          },
          {
            dedicatedServer: {
              is: {
                OR: [{ hostname: { contains: q } }, { primaryIp: { contains: q } }],
              },
            },
          },
          { domain: { is: { domainName: { contains: q } } } },
          { cdnZone: { is: { zoneName: { contains: q } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        vpsInstance: { select: { id: true, hostname: true, primaryIp: true } },
        dedicatedServer: { select: { hostname: true, primaryIp: true } },
        domain: { select: { id: true, domainName: true } },
        cdnZone: { select: { zoneName: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { userId, number: { contains: q } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, status: true, total: true },
    }),
    prisma.topUp.findMany({
      where: {
        userId,
        OR: [{ referenceCode: { contains: q } }, { id: { contains: q } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, referenceCode: true, status: true, amount: true },
    }),
  ]);

  const results: CustomerSearchResult[] = [];

  for (const service of services) {
    const { title, subtitle } = serviceTitle(service);
    results.push({
      id: `service-${service.id}`,
      title,
      subtitle,
      href: serviceHref(service),
      category: "service",
    });
  }

  for (const invoice of invoices) {
    results.push({
      id: `invoice-${invoice.id}`,
      title: invoice.number,
      subtitle: `${invoice.status} · $${Number(invoice.total).toFixed(2)}`,
      href: `/billing/invoices/${invoice.id}`,
      category: "invoice",
    });
  }

  for (const topUp of topUps) {
    results.push({
      id: `topup-${topUp.id}`,
      title: topUp.referenceCode,
      subtitle: `${topUp.status} · $${Number(topUp.amount).toFixed(2)} top-up`,
      href: `/billing/topup/${topUp.id}`,
      category: "topup",
    });
  }

  return results;
}
