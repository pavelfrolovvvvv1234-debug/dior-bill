"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { assertSufficientBalance } from "@/app/actions/order";
import { getLocations, provisionVps, quoteOrderPromo } from "@dior/backend";
import { VPS_PLANS, TURBO_VPS_PLANS, STANDARD_VPS_PLANS } from "@/lib/vps-plans";
import { isLocationAllowedForBulletproofPlan } from "@/lib/vps-plan-locations";
import { rethrowServerActionError } from "@/lib/server-action-error";
import {
  BP_NETWORK_BASE_MBPS,
  calcBpNetworkMonthlyAddon,
  isValidBpNetworkMbps,
  normalizeBpNetworkMbps,
} from "@dior/shared";

const ALL_VPS_PLANS = [...VPS_PLANS, ...TURBO_VPS_PLANS, ...STANDARD_VPS_PLANS];

export async function getVpsOrderOptions() {
  await requireSession();
  const locations = await getLocations();
  return {
    locations,
    plans: VPS_PLANS,
    turboPlans: TURBO_VPS_PLANS,
    standardPlans: STANDARD_VPS_PLANS,
  };
}

export async function deployVpsAction(formData: FormData) {
  try {
    const session = await requireSession();

    const hostname = String(formData.get("hostname") ?? "").trim();
    const locationId = String(formData.get("locationId") ?? "");
    const planId = String(formData.get("planId") ?? "");
    const os = String(formData.get("os") ?? "debian-12");
    const promoCode = String(formData.get("promoCode") ?? "").trim() || undefined;
    const plan = ALL_VPS_PLANS.find((p) => p.id === planId);
    if (!hostname || !locationId || !plan) {
      throw new Error("Fill hostname, location, and plan");
    }

    // Provider is resolved from catalog only — never trust client FormData.
    const isBulletproofInstant = VPS_PLANS.some((p) => p.id === planId);
    const isStandardHostVds = STANDARD_VPS_PLANS.some((p) => p.id === planId);

    let networkMbps = BP_NETWORK_BASE_MBPS;
    if (isBulletproofInstant && !isStandardHostVds) {
      networkMbps = normalizeBpNetworkMbps(formData.get("networkMbps"));
      if (!isValidBpNetworkMbps(networkMbps)) {
        throw new Error("Invalid network speed");
      }
    }

    const networkAddon =
      isBulletproofInstant && !isStandardHostVds
        ? calcBpNetworkMonthlyAddon(networkMbps)
        : 0;
    const monthlySubtotal = plan.price + networkAddon;

    const locations = await getLocations();
    const location = locations.find((l) => l.id === locationId);
    if (!location) {
      throw new Error("Invalid location");
    }
    if (
      isBulletproofInstant &&
      !isStandardHostVds &&
      !isLocationAllowedForBulletproofPlan(planId, location.code)
    ) {
      throw new Error("This location is not available for the selected plan");
    }
    if (isStandardHostVds) {
      const { isHostVdsLocationCode } = await import("@/lib/vps-plan-locations");
      if (!isHostVdsLocationCode(location.code)) {
        throw new Error("This location is not available for standard VPS");
      }
    }

    let chargeAmount = monthlySubtotal;
    if (promoCode) {
      const quote = await quoteOrderPromo(session.user.id, promoCode, monthlySubtotal);
      chargeAmount = quote.finalAmount;
    }
    await assertSufficientBalance(chargeAmount);

    const resolvedProvider = isStandardHostVds ? "hostvds" : "proxmox";

    const idempotencyKey = createHash("sha256")
      .update(
        `${session.user.id}:${hostname}:${locationId}:${planId}:${os}:${networkMbps}:${resolvedProvider}`,
      )
      .digest("hex")
      .slice(0, 32);

    const { vps } = await provisionVps({
      userId: session.user.id,
      hostname,
      locationId,
      plan: {
        cpuCores: plan.cpuCores,
        ramMb: plan.ramMb,
        diskGb: plan.diskGb,
        bandwidthTb: plan.bandwidthTb,
        price: plan.price,
      },
      os,
      prepaid: true,
      promoCode,
      idempotencyKey,
      networkMbps: resolvedProvider === "proxmox" && isBulletproofInstant ? networkMbps : undefined,
      provider: resolvedProvider,
      planId,
    });

    revalidatePath("/services");
    revalidatePath("/plans");
    revalidatePath("/dashboard");
    revalidatePath(`/vps/${vps.id}`);

    return { vpsId: vps.id };
  } catch (err) {
    console.error("[deployVpsAction]", err);
    if (err instanceof Error && err.message.startsWith("Fill ")) {
      throw err;
    }
    if (err instanceof Error && /^(Invalid location|This location|Invalid network speed)/.test(err.message)) {
      throw err;
    }
    rethrowServerActionError(err, "Deploy failed");
  }
}
