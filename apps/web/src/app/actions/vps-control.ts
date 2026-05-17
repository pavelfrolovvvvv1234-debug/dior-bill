"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { vpsAction } from "@dior/backend";

type VpsControlAction =
  | "reboot"
  | "reinstall"
  | "rescue"
  | "reset_password"
  | "start"
  | "stop";

export async function vpsControlAction(vpsId: string, action: VpsControlAction) {
  const session = await requireSession();
  const result = await vpsAction(vpsId, session.user.id, action);
  revalidatePath(`/vps/${vpsId}`);
  revalidatePath("/services");
  return result;
}
