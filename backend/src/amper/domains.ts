import type {
  AmperAccount,
  AmperDnsRecord,
  AmperDomainRecord,
  AmperDomainSearchResponse,
  AmperTldPrice,
} from "./types";
import { amperRequest } from "./client";

export async function amperGetAccount(): Promise<AmperAccount> {
  return amperRequest<AmperAccount>("/account");
}

export async function amperGetDomainPrices(): Promise<AmperTldPrice[]> {
  const data = await amperRequest<{ prices: AmperTldPrice[] }>("/domains/prices");
  return data.prices ?? [];
}

export async function amperSearchDomain(domain: string): Promise<AmperDomainSearchResponse> {
  return amperRequest<AmperDomainSearchResponse>("/domains/search", {
    query: { domain: domain.trim().toLowerCase() },
  });
}

export async function amperBulkSearchDomains(
  domains: string[],
): Promise<AmperDomainSearchResponse> {
  return amperRequest<AmperDomainSearchResponse>("/domains/bulk-search", {
    method: "POST",
    body: { domains },
  });
}

export async function amperListDomains(page = 1, limit = 50): Promise<{
  domains: AmperDomainRecord[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}> {
  return amperRequest("/domains", { query: { page, limit } });
}

export async function amperGetDomain(domain: string): Promise<AmperDomainRecord> {
  return amperRequest<AmperDomainRecord>(`/domains/${encodeURIComponent(domain)}`);
}

export async function amperRegisterDomain(
  domain: string,
  years = 1,
): Promise<AmperDomainRecord> {
  return amperRequest<AmperDomainRecord>("/domains/register", {
    method: "POST",
    body: { domain: domain.trim().toLowerCase(), years },
  });
}

export async function amperGetNameservers(domain: string): Promise<string[]> {
  const data = await amperRequest<{ nameservers: string[] }>(
    `/domains/${encodeURIComponent(domain)}/nameservers`,
  );
  return data.nameservers ?? [];
}

export async function amperSetNameservers(domain: string, nameservers: string[]): Promise<void> {
  await amperRequest(`/domains/${encodeURIComponent(domain)}/nameservers`, {
    method: "PUT",
    body: { nameservers },
  });
}

export async function amperGetDnsRecords(domain: string): Promise<AmperDnsRecord[]> {
  const data = await amperRequest<{ records: AmperDnsRecord[] }>(
    `/domains/${encodeURIComponent(domain)}/dns`,
  );
  return data.records ?? [];
}

export async function amperSetDnsRecords(domain: string, records: AmperDnsRecord[]): Promise<void> {
  await amperRequest(`/domains/${encodeURIComponent(domain)}/dns`, {
    method: "PUT",
    body: { records },
  });
}

export async function verifyAmperIntegration(): Promise<{
  ok: true;
  baseUrl: string;
  account: AmperAccount;
  activeTlds: number;
  sampleSearch: AmperDomainSearchResponse;
}> {
  const { getAmperApiBaseUrl } = await import("./config");
  const account = await amperGetAccount();
  const prices = await amperGetDomainPrices();
  const sampleSearch = await amperSearchDomain(`dior-health-${Date.now()}.com`);
  return {
    ok: true,
    baseUrl: getAmperApiBaseUrl(),
    account,
    activeTlds: prices.filter((p) => p.is_active).length,
    sampleSearch,
  };
}
