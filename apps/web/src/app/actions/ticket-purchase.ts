"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocations, purchaseViaSupportTicket, quoteOrderPromo } from "@dior/backend";
import { assertSufficientBalance } from "@/app/actions/order";
import { requireSession } from "@/lib/auth";
import { BULLETPROOF_DEDICATED_PLANS } from "@/lib/bulletproof-dedicated-plans";
import { STANDARD_DEDICATED_PLANS } from "@/lib/dedicated-plans";
import { STANDARD_VPS_PLANS, TURBO_VPS_PLANS } from "@/lib/vps-plans";
import {
  BULLETPROOF_OFFSHORE_COUNTRY_CODES,
  STANDARD_VPS_COUNTRY_CODES,
} from "@/lib/vps-plan-locations";
import {
  buildDedicatedTicketCopy,
  buildInventoryDedicatedTicketCopy,
  buildStandardVpsTicketCopy,
  buildTurbovdsTicketCopy,
  type TicketOrderProductLine,
} from "@/lib/ticket-order-copy";
import { rethrowServerActionError } from "@/lib/server-action-error";

function parsePromoCode(raw?: string): string | undefined {
  const code = raw?.trim();
  return code ? code : undefined;
}

async function assertBalanceForOrder(
  userId: string,
  amount: number,
  promoCode?: string,
): Promise<void> {
  try {
    let required = amount;
    if (promoCode) {
      const quote = await quoteOrderPromo(userId, promoCode, amount);
      required = quote.finalAmount;
    }
    await assertSufficientBalance(required);
  } catch (err) {
    rethrowServerActionError(err, "Order failed");
  }
}

export async function purchaseDedicatedViaTicketAction(
  input: FormData | {
    planId: string;
    productLine: "bulletproof-dedicated" | "dedicated";
    promoCode?: string;
  },
) {
  const session = await requireSession();

  const planId = input instanceof FormData
    ? String(input.get("planId") ?? "")
    : input.planId;
  const productLine = (input instanceof FormData
    ? String(input.get("productLine") ?? "")
    : input.productLine) as "bulletproof-dedicated" | "dedicated";
  const hostname = input instanceof FormData
    ? String(input.get("hostname") ?? "").trim()
    : undefined;
  const locationId = input instanceof FormData
    ? String(input.get("locationId") ?? "")
    : "";
  const os = input instanceof FormData
    ? String(input.get("os") ?? "debian-12")
    : undefined;
  const promoCode = parsePromoCode(
    input instanceof FormData
      ? String(input.get("promoCode") ?? "")
      : input.promoCode,
  );

  if (productLine !== "bulletproof-dedicated" && productLine !== "dedicated") {
    throw new Error("Invalid product line");
  }

  const catalog =
    productLine === "bulletproof-dedicated"
      ? BULLETPROOF_DEDICATED_PLANS
      : STANDARD_DEDICATED_PLANS;
  const plan = catalog.find((p) => p.id === planId);
  if (!plan) throw new Error("Plan not found");

  if (input instanceof FormData) {
    if (!hostname || !locationId) {
      throw new Error("Fill hostname and region");
    }
  }

  let locationLabel: string | undefined;
  if (locationId) {
    const locations = await getLocations();
    const location = locations.find((l) => l.id === locationId);
    if (!location) throw new Error("Invalid location");

    const allowedCountries =
      productLine === "bulletproof-dedicated"
        ? new Set<string>([...BULLETPROOF_OFFSHORE_COUNTRY_CODES])
        : new Set<string>([...STANDARD_VPS_COUNTRY_CODES]);
    if (!allowedCountries.has(location.country.toUpperCase())) {
      throw new Error(
        productLine === "bulletproof-dedicated"
          ? "This region is not available for bulletproof dedicated servers"
          : "This region is not available for dedicated servers",
      );
    }

    locationLabel = location.city
      ? `${location.name} (${location.city}, ${location.country})`
      : `${location.name} (${location.country})`;
  }

  await assertBalanceForOrder(session.user.id, plan.price, promoCode);

  const copy = buildDedicatedTicketCopy(plan, productLine, {
    hostname,
    locationLabel,
    os,
  });
  const { ticket } = await purchaseViaSupportTicket({
    userId: session.user.id,
    amount: plan.price,
    productLine,
    subject: copy.subject,
    body: copy.body,
    invoiceDescription: copy.invoiceDescription,
    metadata: {
      planId: plan.id,
      productLine,
      ...(hostname ? { hostname } : {}),
      ...(locationId ? { locationId } : {}),
      ...(os ? { os } : {}),
    },
    promoCode,
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  revalidatePath("/plans");
  redirect(`/support/${ticket.id}`);
}

export async function purchaseInventoryDedicatedViaTicketAction(input: {
  inventoryId: string;
  name: string;
  cpu: string;
  monthlyPrice: number;
  bulletproof?: boolean;
  promoCode?: string;
}) {
  const session = await requireSession();
  const price = Number(input.monthlyPrice);
  if (!input.inventoryId || !input.name || price <= 0) {
    throw new Error("Invalid server configuration");
  }

  const promoCode = parsePromoCode(input.promoCode);
  await assertBalanceForOrder(session.user.id, price, promoCode);

  const copy = buildInventoryDedicatedTicketCopy({
    id: input.inventoryId,
    name: input.name,
    cpu: input.cpu,
    monthlyPrice: price,
    bulletproof: input.bulletproof,
  });

  const { ticket } = await purchaseViaSupportTicket({
    userId: session.user.id,
    amount: price,
    productLine: copy.productLine,
    subject: copy.subject,
    body: copy.body,
    invoiceDescription: copy.invoiceDescription,
    metadata: { inventoryId: input.inventoryId, productLine: copy.productLine },
    promoCode,
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function purchaseStandardVpsViaTicketAction(formData: FormData) {
  const session = await requireSession();

  const hostname = String(formData.get("hostname") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const os = String(formData.get("os") ?? "debian-12");
  const promoCode = parsePromoCode(String(formData.get("promoCode") ?? ""));

  const plan = STANDARD_VPS_PLANS.find((p) => p.id === planId);
  if (!hostname || !locationId || !plan) {
    throw new Error("Fill hostname, region, and plan");
  }

  const locations = await getLocations();
  const location = locations.find((l) => l.id === locationId);
  if (!location) throw new Error("Invalid location");

  const allowedCountries = new Set<string>([...STANDARD_VPS_COUNTRY_CODES]);
  if (!allowedCountries.has(location.country.toUpperCase())) {
    throw new Error("This region is not available for standard VPS/VDS");
  }

  await assertBalanceForOrder(session.user.id, plan.price, promoCode);

  const locationLabel = location.city
    ? `${location.name} (${location.city}, ${location.country})`
    : `${location.name} (${location.country})`;

  const copy = buildStandardVpsTicketCopy({
    plan,
    hostname,
    locationLabel,
    locationCode: location.code,
    os,
  });

  const { ticket } = await purchaseViaSupportTicket({
    userId: session.user.id,
    amount: plan.price,
    productLine: "standard-vps",
    subject: copy.subject,
    body: copy.body,
    invoiceDescription: copy.invoiceDescription,
    metadata: { planId, hostname, locationId, os },
    promoCode,
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  revalidatePath("/plans");
  revalidatePath("/services");

  redirect(`/support/${ticket.id}`);
}

export async function purchaseTurbovdsViaTicketAction(formData: FormData) {
  const session = await requireSession();

  const hostname = String(formData.get("hostname") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const os = String(formData.get("os") ?? "debian-12");
  const promoCode = parsePromoCode(String(formData.get("promoCode") ?? ""));

  const plan = TURBO_VPS_PLANS.find((p) => p.id === planId);
  if (!hostname || !locationId || !plan) {
    throw new Error("Fill hostname, region, and plan");
  }

  const locations = await getLocations();
  const location = locations.find((l) => l.id === locationId);
  if (!location) throw new Error("Invalid location");

  await assertBalanceForOrder(session.user.id, plan.price, promoCode);

  const locationLabel = location.city
    ? `${location.name} (${location.city}, ${location.country})`
    : `${location.name} (${location.country})`;

  const copy = buildTurbovdsTicketCopy({
    plan,
    hostname,
    locationLabel,
    locationCode: location.code,
    os,
  });

  const { ticket } = await purchaseViaSupportTicket({
    userId: session.user.id,
    amount: plan.price,
    productLine: "turbovds",
    subject: copy.subject,
    body: copy.body,
    invoiceDescription: copy.invoiceDescription,
    metadata: { planId, hostname, locationId, os },
    promoCode,
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  revalidatePath("/plans");
  revalidatePath("/services");

  return { ticketId: ticket.id };
}
