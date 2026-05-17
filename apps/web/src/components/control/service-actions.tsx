"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateServiceStatusAction } from "@/app/actions/control";

const STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "PENDING",
  "PROVISIONING",
  "EXPIRED",
  "FAILED",
] as const;

export function ServiceActions({
  serviceId,
  status,
}: {
  serviceId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setStatus = (next: (typeof STATUSES)[number]) => {
    start(async () => {
      await updateServiceStatusAction(serviceId, next);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "ACTIVE" && (
        <Button size="sm" disabled={pending} onClick={() => setStatus("ACTIVE")}>
          Activate
        </Button>
      )}
      {status !== "SUSPENDED" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setStatus("SUSPENDED")}>
          Suspend
        </Button>
      )}
      {status !== "CANCELLED" && (
        <Button variant="destructive" size="sm" disabled={pending} onClick={() => setStatus("CANCELLED")}>
          Cancel
        </Button>
      )}
      <select
        className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs"
        value={status}
        disabled={pending}
        onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
