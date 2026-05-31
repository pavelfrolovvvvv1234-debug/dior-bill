"use server";

import { revalidatePath } from "next/cache";
import {
  adminOverrideInvoice,
  adminResolveReview,
  adminUpdateServiceStatus,
  adminUpdateTicket,
  createBroadcast,
  createPromoCode,
  togglePromoCode,
  updateAdminUserRole,
  updateAdminUserStatus,
  updatePayoutStatus,
  updateReferralPercent,
} from "@dior/backend";
import { requireControlSession } from "@/lib/auth";

export async function suspendUserAction(userId: string, reason?: string) {
  const actor = await requireControlSession();
  await updateAdminUserStatus(actor.id, userId, "SUSPENDED", reason);
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

export async function activateUserAction(userId: string) {
  const actor = await requireControlSession();
  await updateAdminUserStatus(actor.id, userId, "ACTIVE");
  revalidatePath("/users");
}

export async function updateRoleAction(userId: string, role: string) {
  const actor = await requireControlSession();
  await updateAdminUserRole(actor.id, userId, role as import("@dior/database").UserRole);
  revalidatePath(`/users/${userId}`);
}

export async function suspendServiceAction(serviceId: string) {
  const actor = await requireControlSession();
  await adminUpdateServiceStatus(actor.id, serviceId, "SUSPENDED");
  revalidatePath("/services");
}

export async function resolveReviewAction(
  reviewId: string,
  action: "approve" | "reject" | "freeze" | "escalate",
) {
  const actor = await requireControlSession();
  await adminResolveReview(actor.id, reviewId, action);
  revalidatePath("/security");
}

export async function createPromoAction(data: {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number;
}) {
  const actor = await requireControlSession();
  await createPromoCode(actor.id, data);
  revalidatePath("/promo");
}

export async function togglePromoAction(id: string, active: boolean) {
  const actor = await requireControlSession();
  await togglePromoCode(actor.id, id, active);
  revalidatePath("/promo");
}

export async function payoutStatusAction(id: string, status: import("@dior/database").PayoutStatus) {
  const actor = await requireControlSession();
  await updatePayoutStatus(actor.id, id, status);
  revalidatePath("/referrals");
}

export async function ticketStatusAction(ticketId: string, status: import("@dior/database").TicketStatus) {
  const actor = await requireControlSession();
  await adminUpdateTicket(actor.id, ticketId, { status });
  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
}

export async function createBroadcastAction(title: string, body: string) {
  const actor = await requireControlSession();
  await createBroadcast(actor.id, { title, body, sendNow: true });
  revalidatePath("/notifications");
}
