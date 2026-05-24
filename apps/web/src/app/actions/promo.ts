"use server";

import { revalidatePath } from "next/cache";
import { redeemPromoCode } from "@dior/backend";
import { getSession } from "@/lib/auth";
import { normalizePromoActionError } from "@/lib/promo-action-error";

export type RedeemPromoCodeResult =
  | {
      ok: true;
      code: string;
      credit: number;
      newBalance: number;
      discountType: string;
    }
  | { ok: false; error: string };

export async function redeemPromoCodeAction(code: string): Promise<RedeemPromoCodeResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const result = await redeemPromoCode(session.user.id, code);

    revalidatePath("/billing");
    revalidatePath("/dashboard");

    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: normalizePromoActionError(err) };
  }
}
