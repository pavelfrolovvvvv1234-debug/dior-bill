"use server";

import { revalidatePath } from "next/cache";
import {
  getDomainById,
  getDomainNameservers,
  getLiveTldPrices,
  registerDomainViaAmper,
  searchDomainAvailability,
  searchDomainAvailabilityBulk,
  updateDomainNameservers,
} from "@dior/backend";
import { assertSufficientBalance } from "@/app/actions/order";
import { requireSession } from "@/lib/auth";
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

export async function registerDomainAction(domain: string, years = 1) {
  const session = await requireSession();
  const parsed = domain.trim().toLowerCase();
  const parts = parsed.split(".");
  const tld = parts[parts.length - 1];
  const zone = getDomainZone(tld);
  if (!zone) {
    throw new Error("This TLD is not available in our catalog");
  }

  await assertSufficientBalance(zone.priceYear);

  try {
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
      domainId: created.id,
      domainName: created.domainName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    throw new Error(message);
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
