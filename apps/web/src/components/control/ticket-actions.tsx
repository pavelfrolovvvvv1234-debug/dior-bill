"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTicketAction, ticketStatusAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";
import { controlPath } from "@/lib/control-paths";

const STATUSES = ["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export function TicketActions({
  ticketId,
  status,
  subject,
}: {
  ticketId: string;
  status: string;
  subject?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isClosed = status === "CLOSED" || status === "RESOLVED";

  function setStatus(next: (typeof STATUSES)[number]) {
    start(async () => {
      await ticketStatusAction(ticketId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {!isClosed && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="gap-1.5"
            onClick={() => setStatus("RESOLVED")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            className="gap-1.5"
            onClick={() => setStatus("CLOSED")}
          >
            <XCircle className="h-3.5 w-3.5" />
            Close ticket
          </Button>
        </>
      )}

      {isClosed && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="gap-1.5"
          onClick={() => setStatus("OPEN")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reopen
        </Button>
      )}

      <AdminDeleteButton
        label="Delete ticket"
        confirmMessage={`Permanently delete ticket "${subject ?? ticketId}"? All messages will be removed. This cannot be undone.`}
        onDelete={() => deleteTicketAction(ticketId)}
        redirectTo={controlPath("/support")}
      />
    </div>
  );
}
