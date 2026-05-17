"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocations, purchaseViaSupportTicket } from "@dior/backend";
import { assertSufficientBalance } from "@/app/actions/order";
import { requireSession } from "@/lib/auth";
import { BULLETPROOF_DEDICATED_PLANS } from "@/lib/bulletproof-dedicated-plans";
import { STANDARD_DEDICATED_PLANS } from "@/lib/dedicated-plans";
import { TURBO_VPS_PLANS } from "@/lib/vps-plans";
import {
  buildDedicatedTicketCopy,
  buildInventoryDedicatedTicketCopy,
  buildTurbovdsTicketCopy,
  type TicketOrderProductLine,
} from "@/lib/ticket-order-copy";

export async function purchaseDedicatedViaTicketAction(input: {
  planId: string;
  productLine: "bulletproof-dedicated" | "dedicated";
}) {
  const session = await requireSession();
  const catalog =
    input.productLine === "bulletproof-dedicated"
      ? BULLETPROOF_DEDICATED_PLANS
      : STANDARD_DEDICATED_PLANS;
  const plan = catalog.find((p) => p.id === input.planId);
  if (!plan) throw new Error("Plan not found");

  await assertSufficientBalance(plan.price);

  const copy = buildDedicatedTicketCopy(plan, input.productLine);
  const { ticket } = await purchaseViaSupportTicket({
    userId: session.user.id,
    amount: plan.price,
    productLine: input.productLine,
    subject: copy.subject,
    body: copy.body,
    invoiceDescription: copy.invoiceDescription,
    metadata: { planId: plan.id, productLine: input.productLine },
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function purchaseInventoryDedicatedViaTicketAction(input: {
  inventoryId: string;
  name: string;
  cpu: string;
  monthlyPrice: number;
  bulletproof?: boolean;
}) {
  const session = await requireSession();
  const price = Number(input.monthlyPrice);
  if (!input.inventoryId || !input.name || price <= 0) {
    throw new Error("Invalid server configuration");
  }

  await assertSufficientBalance(price);

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
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function purchaseTurbovdsViaTicketAction(formData: FormData) {
  const session = await requireSession();

  const hostname = String(formData.get("hostname") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const os = String(formData.get("os") ?? "debian-12");

  const plan = TURBO_VPS_PLANS.find((p) => p.id === planId);
  if (!hostname || !locationId || !plan) {
    throw new Error("Fill hostname, region, and plan");
  }

  const locations = await getLocations();
  const location = locations.find((l) => l.id === locationId);
  if (!location) throw new Error("Invalid location");

  await assertSufficientBalance(plan.price);

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
  });

  revalidatePath("/billing");
  revalidatePath("/support");
  revalidatePath("/plans");
  revalidatePath("/services");

  return { ticketId: ticket.id };
}
