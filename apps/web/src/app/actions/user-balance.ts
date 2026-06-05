"use server";

import { revalidatePath } from "next/cache";
import { adjustUserBalance } from "@dior/backend";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";

export async function adjustBalanceAction(
  userId: string,
  amount: number,
  type: "credit" | "debit",
  reason: string,
) {
  const actor = await requireControlSession();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!reason.trim()) {
    throw new Error("Reason is required");
  }
  const wallet = await adjustUserBalance(actor.id, userId, {
    amount,
    type,
    reason: reason.trim(),
  });
  revalidatePath(controlPath(`/users/${userId}`));
  revalidatePath(controlPath("/users"));
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  return wallet;
}
