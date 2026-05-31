"use server";

import { getUserInvoiceDetail, payInvoiceFromBalance, renderInvoiceText } from "@dior/backend";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getInvoiceAction(invoiceId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return getUserInvoiceDetail(invoiceId, session.user.id);
}

export async function payInvoiceAction(invoiceId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  await payInvoiceFromBalance(invoiceId, session.user.id);
  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${invoiceId}`);
}

export async function downloadInvoiceAction(invoiceId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return renderInvoiceText(invoiceId, session.user.id);
}
