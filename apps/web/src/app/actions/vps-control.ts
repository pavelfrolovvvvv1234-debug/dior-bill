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

export type VpsControlResult =
  | { ok: true; passwordResetQueued?: boolean; passwordSynced?: boolean }
  | { ok: false; error: string };

export async function vpsControlAction(
  vpsId: string,
  action: VpsControlAction,
): Promise<VpsControlResult> {
  try {
    const session = await requireSession();
    const result = await vpsAction(vpsId, session.user.id, action);
    revalidatePath(`/vps/${vpsId}`);
    revalidatePath("/services");
    if (action === "reset_password") {
      return {
        ok: true,
        passwordResetQueued: Boolean(
          (result as { passwordResetQueued?: boolean }).passwordResetQueued,
        ),
        passwordSynced: Boolean(
          (result as { passwordSynced?: boolean }).passwordSynced,
        ),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Action failed",
    };
  }
}
