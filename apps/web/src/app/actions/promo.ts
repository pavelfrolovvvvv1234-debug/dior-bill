"use server";

import { revalidatePath } from "next/cache";
import { redeemPromoCode } from "@dior/backend";
import { getSession } from "@/lib/auth";

export type RedeemPromoCodeResult =
  | {
      ok: true;
      code: string;
      credit: number;
      newBalance: number;
      discountType: string;
    }
  | { ok: false; error: string };

export async function redeemPromoCodeAction(
  code: string,
  baseAmount?: number,
): Promise<RedeemPromoCodeResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const result = await redeemPromoCode(session.user.id, code, baseAmount);

    revalidatePath("/billing");
    revalidatePath("/dashboard");

    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not apply promo code";
    return { ok: false, error: message };
  }
}
