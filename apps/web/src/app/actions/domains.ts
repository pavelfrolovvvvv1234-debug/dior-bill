"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getDomainById,
  getDomainNameservers,
  getLiveTldPrices,
  registerDomainViaAmper,
  searchDomainAvailability,
  updateDomainNameservers,
} from "@dior/backend";
import { assertSufficientBalance } from "@/app/actions/order";
import { requireSession } from "@/lib/auth";
import { getDomainZone } from "@/lib/domain-zones";

export async function searchDomainAction(domain: string) {
  await requireSession();
  return searchDomainAvailability(domain);
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

  const created = await registerDomainViaAmper({
    userId: session.user.id,
    domainName: parsed,
    retailPrice: zone.priceYear,
    years,
  });

  revalidatePath("/services");
  revalidatePath("/plans");
  redirect(`/domains/${created.id}`);
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
