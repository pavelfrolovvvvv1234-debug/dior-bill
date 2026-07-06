"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { vpsControlAction } from "@/app/actions/vps-control";

const ACTIONS = [
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

export function VpsActions({
  vpsId,
  disabled,
  onPasswordReset,
}: {
  vpsId: string;
  disabled?: boolean;
  onPasswordReset?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(action: (typeof ACTIONS)[number]) {
    if (action.confirm && !window.confirm(`Confirm: ${action.label}?`)) return;

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
        if (action.id === "reset_password") {
          setSuccess("Password reset — VM rebooting (wait ~2 min, then refresh page).");
          onPasswordReset?.();
        } else {
          setSuccess(`${action.label} completed`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setPending(null);
      }
    });
  }

  return (
    <div className="grid gap-2">
      {ACTIONS.map((a) => (
        <Button
          key={a.id}
          variant={a.variant}
          className="w-full justify-start"
          disabled={disabled || !!pending}
          onClick={() => run(a)}
        >
          {pending === a.label ? "Processing…" : a.label}
        </Button>
      ))}
      {success && <p className="text-xs text-primary">{success}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
