import { amperDnsRequest } from "./client";
import type { AmperDnsDomain, AmperDnsRecord, AmperDnsSslStatus } from "./types";

function unwrapDomain(data: unknown): AmperDnsDomain {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Amper DNS domain response");
  }
  const o = data as Record<string, unknown>;
  const domain = (o.domain ?? o) as Record<string, unknown>;
  const id = String(domain.id ?? o.id ?? "");
  const name = String(domain.name ?? domain.domain ?? o.name ?? "");
  if (!id || !name) {
    throw new Error("Amper DNS domain response missing id/name");
  }
  const nameservers = normalizeNsList(domain.nameservers ?? domain.ns ?? o.nameservers ?? o.ns);
  return { ...domain, id, name, nameservers } as AmperDnsDomain;
}

function normalizeNsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim().toLowerCase().replace(/\.$/, "")).filter(Boolean);
}

function unwrapRecords(data: unknown): AmperDnsRecord[] {
  if (Array.isArray(data)) return data as AmperDnsRecord[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.records)) return o.records as AmperDnsRecord[];
    if (Array.isArray(o.items)) return o.items as AmperDnsRecord[];
  }
  return [];
}

export async function amperDnsListDomains(): Promise<AmperDnsDomain[]> {
  const data = await amperDnsRequest<unknown>("/domains");
  if (Array.isArray(data)) return data.map((d) => unwrapDomain(d));
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list = (o.domains ?? o.items ?? []) as unknown[];
    if (Array.isArray(list)) return list.map((d) => unwrapDomain(d));
  }
  return [];
}

export async function amperDnsGetDomain(id: string): Promise<AmperDnsDomain> {
  const data = await amperDnsRequest<unknown>(`/domains/${encodeURIComponent(id)}`);
  return unwrapDomain(data);
}

export async function amperDnsAddDomain(name: string): Promise<AmperDnsDomain> {
  const data = await amperDnsRequest<unknown>("/domains", {
    method: "POST",
    body: { name: name.trim().toLowerCase() },
  });
  return unwrapDomain(data);
}

export async function amperDnsDeleteDomain(id: string): Promise<void> {
  await amperDnsRequest(`/domains/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function amperDnsVerifyNs(id: string): Promise<AmperDnsDomain> {
  const data = await amperDnsRequest<unknown>(`/domains/${encodeURIComponent(id)}/verify-ns`, {
    method: "POST",
  });
  return unwrapDomain(data);
}

export async function amperDnsNsCheck(id: string): Promise<unknown> {
  return amperDnsRequest(`/domains/${encodeURIComponent(id)}/ns-check`);
}

export async function amperDnsListRecords(domainId: string): Promise<AmperDnsRecord[]> {
  const data = await amperDnsRequest<unknown>(
    `/domains/${encodeURIComponent(domainId)}/records`,
  );
  return unwrapRecords(data);
}

export async function amperDnsCreateRecord(
  domainId: string,
  record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
  },
): Promise<AmperDnsRecord> {
  const data = await amperDnsRequest<unknown>(
    `/domains/${encodeURIComponent(domainId)}/records`,
    {
      method: "POST",
      body: {
        type: record.type.toUpperCase(),
        name: record.name,
        content: record.content,
        value: record.content,
        ttl: record.ttl ?? 300,
        ...(record.priority != null ? { priority: record.priority } : {}),
      },
    },
  );
  if (data && typeof data === "object" && "record" in (data as object)) {
    return (data as { record: AmperDnsRecord }).record;
  }
  return data as AmperDnsRecord;
}

export async function amperDnsUpdateRecord(
  domainId: string,
  recordId: string,
  patch: Partial<{
    type: string;
    name: string;
    content: string;
    ttl: number;
    priority: number;
  }>,
): Promise<AmperDnsRecord> {
  const body: Record<string, unknown> = { ...patch };
  if (patch.content != null) body.value = patch.content;
  if (patch.type) body.type = patch.type.toUpperCase();
  const data = await amperDnsRequest<unknown>(
    `/domains/${encodeURIComponent(domainId)}/records/${encodeURIComponent(recordId)}`,
    { method: "PATCH", body },
  );
  if (data && typeof data === "object" && "record" in (data as object)) {
    return (data as { record: AmperDnsRecord }).record;
  }
  return data as AmperDnsRecord;
}

export async function amperDnsDeleteRecord(domainId: string, recordId: string): Promise<void> {
  await amperDnsRequest(
    `/domains/${encodeURIComponent(domainId)}/records/${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );
}

export async function amperDnsGetSsl(domainId: string): Promise<AmperDnsSslStatus> {
  const data = await amperDnsRequest<unknown>(`/domains/${encodeURIComponent(domainId)}/ssl`);
  if (data && typeof data === "object" && "ssl" in (data as object)) {
    return (data as { ssl: AmperDnsSslStatus }).ssl;
  }
  return (data ?? {}) as AmperDnsSslStatus;
}

export async function amperDnsScheduleSsl(domainId: string): Promise<AmperDnsSslStatus> {
  const data = await amperDnsRequest<unknown>(
    `/domains/${encodeURIComponent(domainId)}/ssl/schedule-issue`,
    { method: "POST" },
  );
  if (data && typeof data === "object" && "ssl" in (data as object)) {
    return (data as { ssl: AmperDnsSslStatus }).ssl;
  }
  return (data ?? {}) as AmperDnsSslStatus;
}

export async function amperDnsPatchDomain(
  domainId: string,
  patch: Record<string, unknown>,
): Promise<AmperDnsDomain> {
  const data = await amperDnsRequest<unknown>(`/domains/${encodeURIComponent(domainId)}`, {
    method: "PATCH",
    body: patch,
  });
  return unwrapDomain(data);
}
