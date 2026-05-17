"use server";

import { revalidatePath } from "next/cache";
import { redeemPromoCode } from "@dior/backend";
import { requireSession } from "@/lib/auth";

export async function redeemPromoCodeAction(code: string, baseAmount?: number) {
  const session = await requireSession();
  const result = await redeemPromoCode(session.user.id, code, baseAmount);

  revalidatePath("/billing");
  revalidatePath("/dashboard");

  return result;
}
