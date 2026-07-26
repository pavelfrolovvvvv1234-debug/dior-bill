"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { vpsControlAction } from "@/app/actions/vps-control";

const BASE_ACTIONS = [
  { id: "start" as const, label: "Start", variant: "outline" as const },
  { id: "stop" as const, label: "Stop", variant: "outline" as const },
  { id: "reboot" as const, label: "Reboot", variant: "outline" as const },
  { id: "rescue" as const, label: "Rescue mode", variant: "outline" as const },
  { id: "reinstall" as const, label: "Reinstall OS", variant: "outline" as const, confirm: true },
  {
    id: "reset_password" as const,
    label: "Reset password",
    variant: "default" as const,
    confirm: true,
  },
];

const DELETE_ACTION = {
  id: "delete" as const,
  label: "Delete VPS",
  variant: "destructive" as const,
  confirm: true,
};

export function VpsActions({
  vpsId,
  disabled,
  onPasswordReset,
  allowDelete = false,
  deleteDisabled = false,
  hideRescue = false,
}: {
  vpsId: string;
  disabled?: boolean;
  onPasswordReset?: () => void;
  allowDelete?: boolean;
  /** When true, Delete stays available even if power actions are disabled. */
  deleteDisabled?: boolean;
  hideRescue?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);

  const actions = [
    ...(hideRescue ? BASE_ACTIONS.filter((a) => a.id !== "rescue") : BASE_ACTIONS),
    ...(allowDelete ? [DELETE_ACTION] : []),
  ];

  function run(action: (typeof actions)[number]) {
    if (inFlight.current) return;
    if (action.id === "delete") {
      if (
        !window.confirm(
          "Delete this VPS permanently? The remote server will be destroyed and billing stopped. This cannot be undone.",
        )
      ) {
        return;
      }
    } else if (action.confirm && !window.confirm(`Confirm: ${action.label}?`)) {
      return;
    }

    inFlight.current = true;
    setError(null);
    setSuccess(null);
    setPending(action.label);
    startTransition(async () => {
      try {
        const result = await vpsControlAction(vpsId, action.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (action.id === "delete") {
          setSuccess("VPS deleted");
          router.push("/services");
          router.refresh();
          return;
        }
        if (action.id === "reset_password") {
          setSuccess(
            result.passwordSynced
              ? "Password updated in the guest — refresh and use the new password from Access."
              : result.passwordResetQueued
                ? "Password saved — syncing into the VM (wait ~1 min, then refresh)."
                : "Password updated — refresh the page for the new credentials.",
          );
          onPasswordReset?.();
        } else {
          setSuccess(`${action.label} completed`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    });
  }

  return (
    <div className="grid gap-2">
      {actions.map((a) => {
        const isDelete = a.id === "delete";
        const btnDisabled = isDelete
          ? deleteDisabled || !!pending
          : disabled || !!pending;
        return (
          <Button
            key={a.id}
            variant={a.variant}
            className="w-full justify-start"
            disabled={btnDisabled}
            onClick={() => run(a)}
          >
            {pending === a.label ? "Processing…" : a.label}
          </Button>
        );
      })}
      {success && <p className="text-xs text-primary">{success}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
