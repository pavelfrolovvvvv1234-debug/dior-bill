"use server";

import { searchCustomerDashboard } from "@dior/backend";
import { requireSession } from "@/lib/auth";

export async function searchDashboardAction(query: string) {
  const session = await requireSession();
  return searchCustomerDashboard(session.user.id, query);
}
