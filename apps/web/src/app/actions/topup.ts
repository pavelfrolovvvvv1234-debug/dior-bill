"use server";

import {
  createTopUp,
  getTopUpById,
  listUserTopUps,
  getWallet,
  getUserLedger,
  syncTopUpStatus,
} from "@dior/backend";
import type { TopUpProvider } from "@dior/database";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export type CreateTopUpActionResult =
  | {
      ok: true;
      id: string;
      status: string;
      paymentUrl: string | null;
      referenceCode: string;
      provider: TopUpProvider;
    }
  | { ok: false; error: string };

export async function createTopUpAction(input: {
  amount: number;
  provider: TopUpProvider;
  idempotencyKey: string;
}): Promise<CreateTopUpActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    const topUp = await createTopUp({
      userId: session.user.id,
      amount: input.amount,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      ok: true,
      id: topUp.id,
      status: topUp.status,
      paymentUrl: topUp.paymentUrl,
      referenceCode: topUp.referenceCode,
      provider: topUp.provider,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create payment invoice";
    return { ok: false, error: message };
  }
}

export async function getTopUpAction(id: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return getTopUpById(id, session.user.id);
}

export async function syncTopUpAction(id: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return syncTopUpStatus(id, session.user.id);
}

export async function getWalletAction() {
  const session = await getSession();
  if (!session) redirect("/login");
  return getWallet(session.user.id);
}

export async function getTopUpsAction(page = 1) {
  const session = await getSession();
  if (!session) redirect("/login");
  return listUserTopUps(session.user.id, { page });
}

export async function getLedgerAction(page = 1, search?: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return getUserLedger(session.user.id, { page, search });
}
