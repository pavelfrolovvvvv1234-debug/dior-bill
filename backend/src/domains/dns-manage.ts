import { NotFoundError, ValidationError } from "@dior/shared";
import { prisma } from "@dior/database";
import {
  amperDnsAddDomain,
  amperDnsCreateRecord,
  amperDnsDeleteRecord,
  amperDnsGetDomain,
  amperDnsGetSsl,
  amperDnsListDomains,
  amperDnsListRecords,
  amperDnsNsCheck,
  amperDnsScheduleSsl,
  amperDnsVerifyNs,
  getAmperDnsDefaultNameservers,
  isAmperDnsConfigured,
  type AmperDnsRecord,
  type AmperDnsSslStatus,
} from "../amper-dns";
import { isAmperConfigured, amperSetNameservers } from "../amper";
import { normalizeNameservers, parseNameserversFromDb } from "./nameservers";
import { toJsonValue } from "../lib/json";

async function loadDomainForUser(domainId: string, userId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, service: { userId } },
    include: { service: true },
  });
  if (!domain) throw new NotFoundError("Domain not found");
  return domain;
}

function resolveAssignedNs(fromApi: string[] | undefined): string[] {
  const apiNs = (fromApi ?? []).filter(Boolean);
  if (apiNs.length >= 2) return normalizeNameservers(apiNs);
  return normalizeNameservers(getAmperDnsDefaultNameservers());
}

export async function getDomainDnsStatus(domainId: string, userId: string) {
  const domain = await loadDomainForUser(domainId, userId);
  return {
    domainId: domain.id,
    domainName: domain.domainName,
    dnsManaged: domain.dnsManaged,
    amperDnsId: domain.amperDnsId,
    nameservers: parseNameserversFromDb(domain.nameservers),
    amperDnsConfigured: isAmperDnsConfigured(),
    registrarConfigured: isAmperConfigured(),
  };
}

/** Attach domain to Amper DNS, push NS to registrar, verify delegation. */
export async function attachDomainToAmperDns(domainId: string, userId: string) {
  if (!isAmperDnsConfigured()) {
    throw new ValidationError(
      "Amper DNS is not configured — add AMPER_DNS_API_KEY to .env and restart the server",
    );
  }

  const domain = await loadDomainForUser(domainId, userId);
  let amperId = domain.amperDnsId;
  let assignedNs: string[] = [];

  if (amperId) {
    try {
      const existing = await amperDnsGetDomain(amperId);
      assignedNs = resolveAssignedNs(existing.nameservers);
    } catch {
      amperId = null;
    }
  }

  if (!amperId) {
    const listed = await amperDnsListDomains();
    const match = listed.find(
      (d) => d.name.toLowerCase() === domain.domainName.toLowerCase(),
    );
    if (match) {
      amperId = match.id;
      assignedNs = resolveAssignedNs(match.nameservers);
    } else {
      const created = await amperDnsAddDomain(domain.domainName);
      amperId = created.id;
      assignedNs = resolveAssignedNs(created.nameservers);
    }
  }

  if (isAmperConfigured()) {
    await amperSetNameservers(domain.domainName, assignedNs);
  }

  let verified = false;
  try {
    await amperDnsVerifyNs(amperId);
    verified = true;
  } catch {
    try {
      await amperDnsNsCheck(amperId);
    } catch {
      /* NS may still be propagating */
    }
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      amperDnsId: amperId,
      dnsManaged: true,
      nameservers: assignedNs,
      dnsRecords: toJsonValue({
        provider: "amper",
        amperDnsId: amperId,
        assignedNs,
        verifiedAt: verified ? new Date().toISOString() : null,
      }),
    },
    include: { service: true },
  });

  return {
    domainId: updated.id,
    domainName: updated.domainName,
    amperDnsId: amperId,
    nameservers: assignedNs,
    dnsManaged: true,
    verified,
  };
}

export async function listDomainDnsRecords(domainId: string, userId: string) {
  const domain = await loadDomainForUser(domainId, userId);
  if (!domain.dnsManaged || !domain.amperDnsId) {
    throw new ValidationError("Attach the domain to our DNS first");
  }
  const records = await amperDnsListRecords(domain.amperDnsId);
  const normalized = normalizeRecords(records);
  await prisma.domain.update({
    where: { id: domain.id },
    data: {
      dnsRecords: toJsonValue({
        provider: "amper",
        amperDnsId: domain.amperDnsId,
        records: normalized,
        syncedAt: new Date().toISOString(),
      }),
    },
  });
  return { domainId: domain.id, records: normalized };
}

function normalizeRecords(records: AmperDnsRecord[]) {
  return records.map((r) => ({
    id: String(r.id ?? ""),
    type: String(r.type ?? "").toUpperCase(),
    name: String(r.name ?? ""),
    content: String(r.content ?? r.value ?? ""),
    ttl: typeof r.ttl === "number" ? r.ttl : undefined,
    priority: typeof r.priority === "number" ? r.priority : undefined,
  }));
}

export async function createDomainDnsRecord(
  domainId: string,
  userId: string,
  input: { type: string; name: string; content: string; ttl?: number; priority?: number },
) {
  const domain = await loadDomainForUser(domainId, userId);
  if (!domain.dnsManaged || !domain.amperDnsId) {
    throw new ValidationError("Attach the domain to our DNS first");
  }
  const type = input.type.trim().toUpperCase();
  if (!["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"].includes(type)) {
    throw new ValidationError(`Unsupported record type: ${type}`);
  }
  const name = input.name.trim() || "@";
  const content = input.content.trim();
  if (!content) throw new ValidationError("Record value is required");

  await amperDnsCreateRecord(domain.amperDnsId, {
    type,
    name,
    content,
    ttl: input.ttl,
    priority: input.priority,
  });
  return listDomainDnsRecords(domainId, userId);
}

export async function deleteDomainDnsRecord(
  domainId: string,
  userId: string,
  recordId: string,
) {
  const domain = await loadDomainForUser(domainId, userId);
  if (!domain.dnsManaged || !domain.amperDnsId) {
    throw new ValidationError("Attach the domain to our DNS first");
  }
  if (!recordId.trim()) throw new ValidationError("Record id is required");
  await amperDnsDeleteRecord(domain.amperDnsId, recordId.trim());
  return listDomainDnsRecords(domainId, userId);
}

export async function getDomainSslStatus(domainId: string, userId: string): Promise<{
  domainId: string;
  dnsManaged: boolean;
  available: boolean;
  ssl: AmperDnsSslStatus | null;
}> {
  const domain = await loadDomainForUser(domainId, userId);
  if (!domain.dnsManaged || !domain.amperDnsId) {
    return {
      domainId: domain.id,
      dnsManaged: false,
      available: false,
      ssl: null,
    };
  }
  try {
    const ssl = await amperDnsGetSsl(domain.amperDnsId);
    return {
      domainId: domain.id,
      dnsManaged: true,
      available: true,
      ssl,
    };
  } catch (err) {
    return {
      domainId: domain.id,
      dnsManaged: true,
      available: true,
      ssl: {
        status: "unknown",
        message: err instanceof Error ? err.message : "Could not load SSL status",
      },
    };
  }
}

export async function issueDomainSsl(domainId: string, userId: string) {
  const domain = await loadDomainForUser(domainId, userId);
  if (!domain.dnsManaged || !domain.amperDnsId) {
    throw new ValidationError(
      "SSL is available after activating DNS on our service. Add a DNS record in the DNS tab.",
    );
  }
  const ssl = await amperDnsScheduleSsl(domain.amperDnsId);
  return {
    domainId: domain.id,
    dnsManaged: true,
    available: true,
    ssl,
  };
}
