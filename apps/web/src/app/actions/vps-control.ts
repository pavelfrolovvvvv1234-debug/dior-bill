"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { AppError, ValidationError } from "@dior/shared";
import { vpsAction } from "@dior/backend";

type VpsControlAction =
  | "reboot"
  | "reinstall"
  | "rescue"
  | "reset_password"
  | "start"
  | "stop"
  | "delete";

export type VpsControlResult =
  | { ok: true; passwordResetQueued?: boolean; passwordSynced?: boolean }
  | { ok: false; error: string };

function safeControlError(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  if (err instanceof AppError && err.statusCode < 500 && err.message.length < 180) {
    return err.message;
  }
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (
      msg.length > 0 &&
      msg.length < 180 &&
      /^(Cannot |VPS |HostVDS is not|Rescue |Delete |Standard VPS|Fill |Invalid )/i.test(msg)
    ) {
      return msg;
    }
  }
  return "Action failed. Please try again or contact support.";
}

export async function vpsControlAction(
  vpsId: string,
  action: VpsControlAction,
): Promise<VpsControlResult> {
  try {
    const session = await requireSession();
    const result = await vpsAction(vpsId, session.user.id, action);
    revalidatePath(`/vps/${vpsId}`);
    revalidatePath("/services");
    if (action === "delete") {
      revalidatePath("/dashboard");
    }
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
    console.error("[vpsControlAction]", action, vpsId, err);
    return {
      ok: false,
      error: safeControlError(err),
    };
  }
}
