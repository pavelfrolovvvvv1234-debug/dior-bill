"use server";

import { revalidatePath } from "next/cache";
import {
  adminGetDomainNameservers,
  adminResolveReview,
  adminUpdateDomainNameservers,
  adminUpdateServiceStatus,
  adminReplyToTicket,
  adminUpdateTicket,
  createBroadcast,
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
  deleteAdminUser,
  deleteAdminService,
  deleteAdminTicket,
  updateAdminUserRole,
  updateAdminUserStatus,
  updatePayoutStatus,
  updateReferralPercent,
} from "@dior/backend";
import type { ServiceStatus } from "@dior/database";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";

function revalidateControl(...paths: string[]) {
  for (const p of paths) {
    revalidatePath(p);
  }
}

export async function suspendUserAction(userId: string, reason?: string) {
  const actor = await requireControlSession();
  await updateAdminUserStatus(actor.id, userId, "SUSPENDED", reason);
  revalidateControl(controlPath("/users"), controlPath(`/users/${userId}`));
}

export async function activateUserAction(userId: string) {
  const actor = await requireControlSession();
  await updateAdminUserStatus(actor.id, userId, "ACTIVE");
  revalidateControl(controlPath("/users"), controlPath(`/users/${userId}`));
}

export async function updateRoleAction(userId: string, role: string) {
  const actor = await requireControlSession();
  await updateAdminUserRole(actor.id, userId, role as import("@dior/database").UserRole);
  revalidateControl(controlPath(`/users/${userId}`));
}

export async function updateServiceStatusAction(
  serviceId: string,
  status: ServiceStatus,
  reason?: string,
) {
  const actor = await requireControlSession();
  await adminUpdateServiceStatus(actor.id, serviceId, status, reason);
  revalidateControl(controlPath("/services"), controlPath(`/services/${serviceId}`));
}

export async function suspendServiceAction(serviceId: string) {
  await updateServiceStatusAction(serviceId, "SUSPENDED");
}

export async function resolveReviewAction(
  reviewId: string,
  action: "approve" | "reject" | "freeze" | "escalate",
) {
  const actor = await requireControlSession();
  await adminResolveReview(actor.id, reviewId, action);
  revalidateControl(controlPath("/security"));
}

export async function createPromoAction(data: {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number;
}) {
  const actor = await requireControlSession();
  await createPromoCode(actor.id, data);
  revalidateControl(controlPath("/promo"));
}

export async function togglePromoAction(id: string, active: boolean) {
  const actor = await requireControlSession();
  await togglePromoCode(actor.id, id, active);
  revalidateControl(controlPath("/promo"));
}

export async function deletePromoAction(id: string) {
  const actor = await requireControlSession();
  await deletePromoCode(actor.id, id);
  revalidateControl(controlPath("/promo"));
}

export async function payoutStatusAction(id: string, status: import("@dior/database").PayoutStatus) {
  const actor = await requireControlSession();
  await updatePayoutStatus(actor.id, id, status);
  revalidateControl(controlPath("/referrals"));
}

export async function ticketStatusAction(ticketId: string, status: import("@dior/database").TicketStatus) {
  const actor = await requireControlSession();
  await adminUpdateTicket(actor.id, ticketId, { status });
  revalidateControl(controlPath("/support"), controlPath(`/support/${ticketId}`));
}

export async function adminReplyTicketAction(ticketId: string, formData: FormData) {
  const actor = await requireControlSession();
  const body = String(formData.get("body") ?? "").trim();
  const internal = formData.get("internal") === "on";
  if (!body) throw new Error("Message is required");

  await adminReplyToTicket(actor.id, ticketId, body, { internal });
  revalidateControl(controlPath("/support"), controlPath(`/support/${ticketId}`));
}

export async function createBroadcastAction(title: string, body: string) {
  const actor = await requireControlSession();
  await createBroadcast(actor.id, { title, body, sendNow: true });
  revalidateControl(controlPath("/notifications"));
}

export async function adminUpdateDomainNameserversAction(
  serviceId: string,
  nameservers: string[],
) {
  const actor = await requireControlSession();
  await adminUpdateDomainNameservers(actor.id, serviceId, nameservers);
  revalidateControl(controlPath(`/services/${serviceId}`));
}

export async function adminRefreshDomainNameserversAction(serviceId: string) {
  const actor = await requireControlSession();
  const result = await adminGetDomainNameservers(actor.id, serviceId, { refresh: true });
  revalidateControl(controlPath(`/services/${serviceId}`));
  return result.nameservers;
}

export async function deleteUserAction(userId: string) {
  const actor = await requireControlSession();
  await deleteAdminUser(actor.id, userId);
  revalidateControl(controlPath("/users"));
}

export async function deleteServiceAction(serviceId: string) {
  const actor = await requireControlSession();
  await deleteAdminService(actor.id, serviceId);
  revalidateControl(controlPath("/services"));
}

export async function deleteTicketAction(ticketId: string) {
  const actor = await requireControlSession();
  await deleteAdminTicket(actor.id, ticketId);
  revalidateControl(controlPath("/support"));
}
