"use server";

import { createVpsUpgradeInvoice } from "@dior/backend";
import { requireSession } from "@/lib/auth";
import { ALL_CATALOG_VPS_PLANS } from "@/lib/vps-plans";
import { rethrowServerActionError } from "@/lib/server-action-error";
import { revalidatePath } from "next/cache";

export async function createVpsUpgradeInvoiceAction(vpsId: string, planId: string): Promise<string> {
  try {
    const session = await requireSession();
    const plan = ALL_CATALOG_VPS_PLANS.find((p) => p.id === planId);
    if (!plan) throw new Error("Invalid plan");

    const { invoiceId } = await createVpsUpgradeInvoice({
      userId: session.user.id,
      vpsId,
      plan: {
        cpuCores: plan.cpuCores,
        ramMb: plan.ramMb,
        diskGb: plan.diskGb,
        monthlyPrice: plan.price,
        planLabel: plan.name,
      },
    });

    revalidatePath("/services");
    revalidatePath(`/vps/${vpsId}`);
    revalidatePath("/billing");

    return invoiceId;
  } catch (err) {
    rethrowServerActionError(err, "Could not create upgrade invoice");
  }
}
