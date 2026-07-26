"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  attachDomainToAmperDns,
  createDomainDnsRecord,
  deleteDomainDnsRecord,
  getDomainById,
  getDomainDnsStatus,
  getDomainNameservers,
  getDomainSslStatus,
  getLiveTldPrices,
  issueDomainSsl,
  listDomainDnsRecords,
  registerDomainViaAmper,
  searchDomainAvailability,
  searchDomainAvailabilityBulk,
  updateDomainNameservers,
} from "@dior/backend";
import { AppError } from "@dior/shared";
import { assertSufficientBalance } from "@/app/actions/order";
import { requireSession } from "@/lib/auth";
import { getServerActionErrorMessage } from "@/lib/server-action-error";
import {
  BULLETPROOF_DOMAIN_ZONES,
  buildSearchTldList,
  getDomainZone,
  parseDomainSearchInput,
} from "@/lib/domain-zones";

export async function searchDomainAction(domain: string) {
  await requireSession();
  return searchDomainAvailability(domain);
}

export async function searchDomainsBulkAction(input: string) {
  await requireSession();
  const parsed = parseDomainSearchInput(input);
  if (!parsed) {
    throw new Error("Enter a valid domain name (letters, numbers, hyphens).");
  }

  const tlds = buildSearchTldList(parsed.primaryTld);
  const domains = tlds.map((tld) => `${parsed.label}.${tld}`);
  const catalogPrices = Object.fromEntries(
    BULLETPROOF_DOMAIN_ZONES.map((z) => [z.tld, z.priceYear]),
  );

  const results = await searchDomainAvailabilityBulk(domains, catalogPrices);
  const primaryDomain = parsed.fqdn ?? `${parsed.label}.com`;

  let merged = results;
  if (parsed.fqdn && !results.some((r) => r.domain === primaryDomain)) {
    const [primaryRow] = await searchDomainAvailabilityBulk([primaryDomain], catalogPrices);
    if (primaryRow) merged = [primaryRow, ...results];
  }

  const inCatalog = merged.filter((r) => r.inCatalog);
  const availableFirst = [...inCatalog].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.domain.localeCompare(b.domain);
  });

  return {
    label: parsed.label,
    query: primaryDomain,
    primaryDomain,
    results: availableFirst,
  };
}

export async function getDomainPricesAction() {
  await requireSession();
  try {
    const prices = await getLiveTldPrices();
    return { ok: true as const, prices };
  } catch {
    return { ok: false as const, prices: [] };
  }
}

export type RegisterDomainActionResult =
  | { ok: true; domainId: string; domainName: string }
  | { ok: false; error: string };

export async function registerDomainAction(
  domain: string,
  years = 1,
): Promise<RegisterDomainActionResult> {
  try {
    const session = await requireSession();
    const parsed = domain.trim().toLowerCase();
    const parts = parsed.split(".");
    const tld = parts[parts.length - 1];
    const zone = getDomainZone(tld);
    if (!zone) {
      return { ok: false, error: "This TLD is not available in our catalog" };
    }

    await assertSufficientBalance(zone.priceYear);

    const created = await registerDomainViaAmper({
      userId: session.user.id,
      domainName: parsed,
      retailPrice: zone.priceYear,
      years,
    });

    revalidatePath("/services");
    revalidatePath("/plans");
    revalidatePath("/dashboard");
    revalidatePath("/domains");

    return {
      ok: true,
      domainId: created.id,
      domainName: created.domainName,
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message =
      err instanceof AppError
        ? err.message
        : getServerActionErrorMessage(err, "Registration failed");
    console.error("[registerDomainAction]", message, err);
    return { ok: false, error: message };
  }
}

export async function updateDomainNameserversAction(domainId: string, nameservers: string[]) {
  const session = await requireSession();
  const result = await updateDomainNameservers(domainId, session.user.id, nameservers);
  revalidatePath(`/domains/${domainId}`);
  revalidatePath("/services");
  return result;
}

export async function refreshDomainNameserversAction(domainId: string) {
  const session = await requireSession();
  const result = await getDomainNameservers(domainId, session.user.id, { refresh: true });
  revalidatePath(`/domains/${domainId}`);
  return result.nameservers;
}

export async function getDomainDetailAction(domainId: string) {
  const session = await requireSession();
  return getDomainById(domainId, session.user.id);
}

function revalidateDomain(domainId: string) {
  revalidatePath(`/domains/${domainId}`);
  revalidatePath("/services");
}

export async function getDomainDnsStatusAction(domainId: string) {
  const session = await requireSession();
  return getDomainDnsStatus(domainId, session.user.id);
}

export async function attachDomainDnsAction(domainId: string) {
  try {
    const session = await requireSession();
    const result = await attachDomainToAmperDns(domainId, session.user.id);
    revalidateDomain(domainId);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not attach DNS"),
    };
  }
}

export async function listDomainDnsRecordsAction(domainId: string) {
  try {
    const session = await requireSession();
    const result = await listDomainDnsRecords(domainId, session.user.id);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not load DNS records"),
      records: [] as Array<{
        id: string;
        type: string;
        name: string;
        content: string;
        ttl?: number;
        priority?: number;
      }>,
    };
  }
}

export async function createDomainDnsRecordAction(
  domainId: string,
  input: { type: string; name: string; content: string; ttl?: number; priority?: number },
) {
  try {
    const session = await requireSession();
    const result = await createDomainDnsRecord(domainId, session.user.id, input);
    revalidateDomain(domainId);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not create DNS record"),
    };
  }
}

export async function deleteDomainDnsRecordAction(domainId: string, recordId: string) {
  try {
    const session = await requireSession();
    const result = await deleteDomainDnsRecord(domainId, session.user.id, recordId);
    revalidateDomain(domainId);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not delete DNS record"),
    };
  }
}

export async function getDomainSslStatusAction(domainId: string) {
  try {
    const session = await requireSession();
    const result = await getDomainSslStatus(domainId, session.user.id);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not load SSL status"),
    };
  }
}

export async function issueDomainSslAction(domainId: string) {
  try {
    const session = await requireSession();
    const result = await issueDomainSsl(domainId, session.user.id);
    revalidateDomain(domainId);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: getServerActionErrorMessage(err, "Could not issue SSL"),
    };
  }
}
