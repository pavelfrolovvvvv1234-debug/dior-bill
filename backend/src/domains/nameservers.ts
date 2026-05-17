import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { amperGetNameservers, isAmperConfigured } from "../amper";
import { syncDomainNameserversToAmper } from "./amper-service";
import { requirePermission } from "../admin/rbac";

export function parseNameserversFromDb(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}

export function normalizeNameservers(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const ns = item.trim().toLowerCase().replace(/\.$/, "");
    if (!ns || seen.has(ns)) continue;
    if (
      !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
        ns,
      )
    ) {
      throw new ValidationError(`Invalid nameserver: ${item}`);
    }
    seen.add(ns);
    out.push(ns);
  }
  if (out.length < 2) {
    throw new ValidationError("Provide at least 2 nameservers");
  }
  if (out.length > 8) {
    throw new ValidationError("Maximum 8 nameservers");
  }
  return out;
}

async function loadDomainForUser(domainId: string, userId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, service: { userId } },
    include: { service: true },
  });
  if (!domain) throw new NotFoundError("Domain not found");
  return domain;
}

export async function getDomainNameservers(
  domainId: string,
  userId: string,
  options?: { refresh?: boolean },
): Promise<{ domainName: string; nameservers: string[]; amperConfigured: boolean }> {
  const domain = await loadDomainForUser(domainId, userId);
  const amperConfigured = isAmperConfigured();

  if (options?.refresh && amperConfigured) {
    try {
      const live = await amperGetNameservers(domain.domainName);
      if (live.length > 0) {
        await prisma.domain.update({
          where: { id: domain.id },
          data: { nameservers: live },
        });
        return { domainName: domain.domainName, nameservers: live, amperConfigured };
      }
    } catch {
      /* use DB fallback */
    }
  }

  const nameservers = parseNameserversFromDb(domain.nameservers);
  return { domainName: domain.domainName, nameservers, amperConfigured };
}

export async function updateDomainNameservers(
  domainId: string,
  userId: string,
  nameservers: string[],
) {
  const normalized = normalizeNameservers(nameservers);
  await syncDomainNameserversToAmper(domainId, normalized, { userId });
  return getDomainNameservers(domainId, userId);
}

export async function adminGetDomainNameservers(
  actorId: string,
  serviceId: string,
  options?: { refresh?: boolean },
) {
  await requirePermission(actorId, "services.read");

  const domain = await prisma.domain.findFirst({
    where: { serviceId },
    include: { service: true },
  });
  if (!domain) throw new NotFoundError("Domain not found for this service");

  return getDomainNameservers(domain.id, domain.service.userId, options);
}

export async function adminUpdateDomainNameservers(
  actorId: string,
  serviceId: string,
  nameservers: string[],
) {
  await requirePermission(actorId, "services.write");

  const domain = await prisma.domain.findFirst({ where: { serviceId } });
  if (!domain) throw new NotFoundError("Domain not found for this service");

  const normalized = normalizeNameservers(nameservers);
  await syncDomainNameserversToAmper(domain.id, normalized);

  return adminGetDomainNameservers(actorId, serviceId);
}
