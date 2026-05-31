"use server";

import { getWallet } from "@dior/backend";
import { requireSession } from "@/lib/auth";
import { INSUFFICIENT_BALANCE_MESSAGE } from "@/lib/order-errors";

export async function checkSufficientBalance(requiredAmount: number) {
  const session = await requireSession();
  const wallet = await getWallet(session.user.id);
  const spendable = wallet.spendable;
  return {
    sufficient: spendable >= requiredAmount,
    available: spendable,
    required: requiredAmount,
  };
}

export async function assertSufficientBalance(requiredAmount: number) {
  const result = await checkSufficientBalance(requiredAmount);
  if (!result.sufficient) {
    throw new Error(INSUFFICIENT_BALANCE_MESSAGE);
  }
  return result;
}
