"use server";

import { revalidatePath } from "next/cache";
import {
  adminApproveTopUp,
  adminForceComplete,
  adminGrantCredits,
  adminOverrideInvoice,
  adminRefundToBalance,
  adminRejectTopUp,
  adminSetBalanceLock,
  adminSyncTopUp,
  adminTriggerReconciliation,
  adminExtendServiceRenewal,
  adminToggleServiceAutoRenew,
  createManualInvoice,
  createTopUp,
  updateReferralPercent,
} from "@dior/backend";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";

type ReconciliationDomain =
  | "billing_service"
  | "inventory_capacity"
  | "provisioning_proxmox"
  | "ip_allocation";

function revalidateBilling(...segments: string[]) {
  for (const segment of segments) {
    revalidatePath(controlPath(segment));
  }
}

export async function invoiceOverrideAction(
  invoiceId: string,
  action: "mark_paid" | "void" | "extend",
  note?: string,
) {
  const actor = await requireControlSession();
  await adminOverrideInvoice(actor.id, invoiceId, { action, note });
  revalidateBilling("/billing", "/billing/invoices", `/billing/invoices/${invoiceId}`);
}

export async function createManualInvoiceAction(
  userId: string,
  data: {
    description: string;
    amount: number;
    dueInDays?: number;
    notes?: string;
  },
) {
  const actor = await requireControlSession();
  const invoice = await createManualInvoice(actor.id, userId, data);
  revalidateBilling("/billing", "/billing/invoices", `/users/${userId}`);
  return invoice.id;
}

export async function approveTopUpAction(topUpId: string, partialAmount?: number, notes?: string) {
  const actor = await requireControlSession();
  await adminApproveTopUp(actor.id, topUpId, partialAmount, notes);
  revalidateBilling("/billing/top-ups", `/billing/top-ups/${topUpId}`, "/payments");
}

export async function rejectTopUpAction(topUpId: string, reason: string) {
  const actor = await requireControlSession();
  await adminRejectTopUp(actor.id, topUpId, reason);
  revalidateBilling("/billing/top-ups", `/billing/top-ups/${topUpId}`, "/payments");
}

export async function forceCompleteTopUpAction(topUpId: string, notes?: string) {
  const actor = await requireControlSession();
  await adminForceComplete(actor.id, topUpId, notes);
  revalidateBilling("/billing/top-ups", `/billing/top-ups/${topUpId}`);
}

export async function syncTopUpAction(topUpId: string) {
  const actor = await requireControlSession();
  await adminSyncTopUp(actor.id, topUpId);
  revalidateBilling("/billing/top-ups", `/billing/top-ups/${topUpId}`);
}

export async function createManualTopUpAction(userId: string, amount: number) {
  const actor = await requireControlSession();
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
  await createTopUp({
    userId,
    amount,
    provider: "MANUAL_TRANSFER",
    idempotencyKey: `admin:manual:${actor.id}:${Date.now()}`,
  });
  revalidateBilling("/billing/top-ups", `/users/${userId}`);
}

export async function refundToBalanceAction(
  userId: string,
  amount: number,
  reason: string,
  invoiceId?: string,
) {
  const actor = await requireControlSession();
  await adminRefundToBalance(actor.id, userId, { amount, reason, invoiceId });
  revalidateBilling("/billing/transactions", `/users/${userId}`);
}

export async function setBalanceLockAction(userId: string, lockedAmount: number, reason: string) {
  const actor = await requireControlSession();
  await adminSetBalanceLock(actor.id, userId, { lockedAmount, reason });
  revalidateBilling(`/users/${userId}`);
}

export async function grantCreditsAction(userId: string, amount: number, reason: string) {
  const actor = await requireControlSession();
  await adminGrantCredits(actor.id, userId, { amount, reason });
  revalidateBilling(`/users/${userId}`);
}

export async function triggerReconciliationAction(domain: ReconciliationDomain) {
  const actor = await requireControlSession();
  await adminTriggerReconciliation(actor.id, domain);
  revalidateBilling("/billing/reconciliation");
}

export async function updateReferralPercentAction(userId: string, percent: number | null) {
  const actor = await requireControlSession();
  await updateReferralPercent(actor.id, userId, percent);
  revalidateBilling(`/users/${userId}`, "/referrals");
}

export async function toggleAutoRenewAction(serviceId: string, autoRenew: boolean) {
  const actor = await requireControlSession();
  await adminToggleServiceAutoRenew(actor.id, serviceId, autoRenew);
  revalidateBilling(`/services/${serviceId}`);
}

export async function extendRenewalAction(serviceId: string, days: number) {
  const actor = await requireControlSession();
  await adminExtendServiceRenewal(actor.id, serviceId, days);
  revalidateBilling(`/services/${serviceId}`);
}

export async function markPayoutPaidAction(payoutId: string) {
  const actor = await requireControlSession();
  const { updatePayoutStatus } = await import("@dior/backend");
  await updatePayoutStatus(actor.id, payoutId, "PAID");
  revalidateBilling("/referrals");
}
