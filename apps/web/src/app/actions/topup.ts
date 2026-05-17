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

export async function createTopUpAction(input: {
  amount: number;
  provider: TopUpProvider;
  idempotencyKey: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const topUp = await createTopUp({
    userId: session.user.id,
    amount: input.amount,
    provider: input.provider,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    id: topUp.id,
    status: topUp.status,
    paymentUrl: topUp.paymentUrl,
    referenceCode: topUp.referenceCode,
    provider: topUp.provider,
  };
}

export async function getTopUpAction(id: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  return getTopUpById(id, session.user.id);
}

export async function syncTopUpAction(id: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await getTopUpById(id, session.user.id);
  return syncTopUpStatus(id);
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
