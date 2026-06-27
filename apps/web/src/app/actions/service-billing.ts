"use server";

import { createUserRenewalInvoice } from "@dior/backend";
import { requireSession } from "@/lib/auth";
import { rethrowServerActionError } from "@/lib/server-action-error";

export async function createRenewalInvoiceAction(serviceId: string): Promise<string> {
  try {
    const session = await requireSession();
    const { invoiceId } = await createUserRenewalInvoice(session.user.id, serviceId);
    return invoiceId;
  } catch (err) {
    rethrowServerActionError(err, "Could not create renewal invoice");
  }
}
