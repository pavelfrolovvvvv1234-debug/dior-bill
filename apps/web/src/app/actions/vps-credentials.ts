"use server";

import { getVpsAccessInfo } from "@dior/backend";
import { requireSession } from "@/lib/auth";

export async function getVpsCredentialsAction(vpsId: string) {
  const session = await requireSession();
  return getVpsAccessInfo(vpsId, session.user.id);
}
