import { ConflictError, NotFoundError, ValidationError } from "@dior/shared";
import {
  amperGetDomainPrices,
  amperGetAccount,
  amperRegisterDomain,
  amperGetDomain,
  amperSearchDomain,
  amperBulkSearchDomains,
  amperSetNameservers,
  amperGetNameservers,
  AmperApiError,
  isAmperConfigured,
} from "../amper";
import { creditWallet } from "../payments/wallet";
import { payInvoiceFromBalance } from "../billing";
import { createInvoiceInEngine } from "../core/billing/invoice-engine";
import { createServiceOrder } from "../core/provisioning/engine";
import { createSubscription } from "../core/billing/subscriptions";
import { prisma } from "@dior/database";
import { createHash } from "crypto";

export type DomainAvailabilityResult = {
  domain: string;
  available: boolean;
  premium: boolean;
  amperPrice: number;
  tld: string;
};

export type DomainBulkSearchResult = DomainAvailabilityResult & {
  catalogPrice: number | null;
  inCatalog: boolean;
};

function mapSearchHit(hit: {
  domain: string;
  available: boolean;
  premium: boolean;
  price: number;
  tld: string;
}): DomainAvailabilityResult {
  return {
    domain: hit.domain,
    available: hit.available,
    premium: hit.premium,
    amperPrice: hit.price,
    tld: hit.tld.replace(/^\./, ""),
  };
}

export async function searchDomainAvailability(domain: string): Promise<DomainAvailabilityResult> {
  if (!isAmperConfigured()) {
    throw new ValidationError(
      "Amper API is not configured — add AMPER_API_TOKEN to .env and restart the server",
    );
  }

  const fqdn = domain.trim().toLowerCase();
  if (!fqdn.includes(".")) {
    throw new ValidationError("Enter a valid domain name");
  }

  const data = await amperSearchDomain(fqdn);
  const hit = data.results.find((r) => r.domain === fqdn) ?? data.results[0];
  if (!hit) {
    throw new ValidationError("Could not check domain availability");
  }

  return mapSearchHit(hit);
}

async function assertRegistrarCanRegister(requiredAmount: number) {
  const account = await amperGetAccount();
  if (account.balance < requiredAmount) {
    throw new ValidationError(
      "Domain registration is temporarily unavailable — registrar balance is low. Please contact support.",
    );
  }
}

export async function searchDomainAvailabilityBulk(
  domains: string[],
  catalogPrices: Record<string, number>,
): Promise<DomainBulkSearchResult[]> {
  if (!isAmperConfigured()) {
    throw new ValidationError(
      "Amper API is not configured — add AMPER_API_TOKEN to .env and restart the server",
    );
  }

  const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) {
    throw new ValidationError("Enter a valid domain name");
  }

  const data =
    unique.length === 1
      ? await amperSearchDomain(unique[0])
      : await amperBulkSearchDomains(unique);

  const byDomain = new Map(data.results.map((hit) => [hit.domain, mapSearchHit(hit)]));

  return unique.map((fqdn) => {
    const hit = byDomain.get(fqdn);
    const tld = fqdn.split(".").pop() ?? "";
    const catalogPrice = catalogPrices[tld] ?? null;
    if (!hit) {
      return {
        domain: fqdn,
        available: false,
        premium: false,
        amperPrice: 0,
        tld,
        catalogPrice,
        inCatalog: catalogPrice != null,
      };
    }
    return {
      ...hit,
      catalogPrice,
      inCatalog: catalogPrice != null,
    };
  });
}

export async function getLiveTldPrices(): Promise<
  Array<{ tld: string; price: number; isActive: boolean }>
> {
  const prices = await amperGetDomainPrices();
  return prices.map((p) => ({
    tld: p.tld.replace(/^\./, ""),
    price: p.price,
    isActive: p.is_active,
  }));
}

function domainIdempotencyKey(userId: string, domainName: string): string {
  return createHash("sha256")
    .update(`domain:${userId}:${domainName}`)
    .digest("hex")
    .slice(0, 32);
}

async function findExistingLocalDomain(domainName: string, userId: string) {
  return prisma.domain.findFirst({
    where: { domainName, service: { userId } },
    include: { service: true },
  });
}

async function provisionLocalDomain(params: {
  userId: string;
  domainName: string;
  retailPrice: number;
  years: number;
  idem: string;
}) {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + params.years);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "DOMAIN",
    label: params.domainName,
    monthlyPrice: params.retailPrice / 12,
    idempotencyKey: params.idem,
    activateImmediately: true,
  });

  await createSubscription({
    serviceId,
    nextRenewAt: expiresAt,
    idempotencyKey: `domain:sub:${params.idem}`,
  });

  let nameservers: string[] = ["ns1.dior.cloud", "ns2.dior.cloud"];
  try {
    const ns = await amperGetNameservers(params.domainName);
    if (ns.length > 0) nameservers = ns;
  } catch {
    /* use defaults */
  }

  const existingRow = await prisma.domain.findUnique({ where: { domainName: params.domainName } });
  if (existingRow) {
    return prisma.domain.findFirstOrThrow({
      where: { id: existingRow.id },
      include: { service: true },
    });
  }

  return prisma.domain.create({
    data: {
      serviceId,
      domainName: params.domainName,
      status: "ACTIVE",
      registrar: "amper",
      expiresAt,
      nameservers,
    },
    include: { service: true },
  });
}

async function refundDomainCharge(params: {
  userId: string;
  amount: number;
  domainName: string;
  reason: string;
  error?: unknown;
}) {
  await creditWallet({
    userId: params.userId,
    amount: params.amount,
    description: `Refund: domain registration failed for ${params.domainName}`,
    metadata: {
      domain: params.domainName,
      reason: params.reason,
      error:
        params.error instanceof AmperApiError
          ? params.error.code
          : params.error instanceof Error
            ? params.error.message
            : "UNKNOWN",
    },
  });
}

/** True when registrar already holds this domain under our Amper account. */
async function isOwnedAtRegistrar(domainName: string): Promise<boolean> {
  try {
    await amperGetDomain(domainName);
    return true;
  } catch (err) {
    if (err instanceof AmperApiError && (err.code === "NOT_FOUND" || err.code === "DOMAIN_NOT_FOUND")) {
      return false;
    }
    throw err;
  }
}

export async function registerDomainViaAmper(params: {
  userId: string;
  domainName: string;
  retailPrice: number;
  years?: number;
}) {
  if (!isAmperConfigured()) {
    throw new ValidationError("Domain registration is temporarily unavailable");
  }

  const domainName = params.domainName.trim().toLowerCase();
  const years = params.years ?? 1;
  const idem = domainIdempotencyKey(params.userId, domainName);

  const alreadyLocal = await findExistingLocalDomain(domainName, params.userId);
  if (alreadyLocal) return alreadyLocal;

  const otherOwner = await prisma.domain.findUnique({ where: { domainName } });
  if (otherOwner) throw new ConflictError("Domain already registered in DIOR");

  const ownedAtRegistrar = await isOwnedAtRegistrar(domainName);
  if (!ownedAtRegistrar) {
    const availability = await searchDomainAvailability(domainName);
    if (!availability.available) {
      throw new ValidationError(`Domain ${domainName} is not available`);
    }
    const registrarCost = availability.amperPrice > 0 ? availability.amperPrice : params.retailPrice;
    await assertRegistrarCanRegister(registrarCost);
  }

  const invoice = await createInvoiceInEngine({
    userId: params.userId,
    items: [
      {
        description: `Domain registration: ${domainName} (${years}y)`,
        unitPrice: params.retailPrice,
        quantity: 1,
      },
    ],
    idempotencyKey: `domain:inv:${idem}`,
  });

  await payInvoiceFromBalance(invoice.id, params.userId);
  let charged = true;

  const refundIfNeeded = async (reason: string, error?: unknown) => {
    if (!charged) return;
    await refundDomainCharge({
      userId: params.userId,
      amount: params.retailPrice,
      domainName,
      reason,
      error,
    });
    charged = false;
  };

  try {
    if (!ownedAtRegistrar) {
      try {
        await amperRegisterDomain(domainName, years);
      } catch (err) {
        if (err instanceof AmperApiError && err.code === "DOMAIN_ALREADY_OWNED") {
          /* previous attempt registered at Amper — continue local provision */
        } else {
          await refundIfNeeded("amper_register_failed", err);
          if (err instanceof AmperApiError && err.code === "INSUFFICIENT_BALANCE") {
            throw new ValidationError(
              "Registrar balance is low — payment refunded. Please contact support.",
            );
          }
          throw err;
        }
      }
    }

    return await provisionLocalDomain({
      userId: params.userId,
      domainName,
      retailPrice: params.retailPrice,
      years,
      idem,
    });
  } catch (err) {
    const recovered = await findExistingLocalDomain(domainName, params.userId);
    if (recovered) return recovered;

    await refundIfNeeded("local_provision_failed", err);
    throw err;
  }
}

export async function syncDomainNameserversToAmper(
  domainId: string,
  nameservers: string[],
  opts?: { userId?: string },
) {
  const domain = await prisma.domain.findFirst({
    where: opts?.userId ? { id: domainId, service: { userId: opts.userId } } : { id: domainId },
  });
  if (!domain) throw new NotFoundError("Domain not found");
  if (!isAmperConfigured()) {
    return prisma.domain.update({
      where: { id: domain.id },
      data: { nameservers },
    });
  }
  await amperSetNameservers(domain.domainName, nameservers);
  return prisma.domain.update({
    where: { id: domain.id },
    data: { nameservers },
  });
}
