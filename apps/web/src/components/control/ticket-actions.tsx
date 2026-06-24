"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTicketAction, ticketPriorityAction, ticketStatusAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";
import { TicketPriorityBadge } from "@/components/support/ticket-priority-badge";
import { controlPath } from "@/lib/control-paths";
import { ALL_TICKET_PRIORITIES } from "@dior/shared";

const STATUSES = ["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export function TicketActions({
  ticketId,
  status,
  priority,
  subject,
}: {
  ticketId: string;
  status: string;
  priority: string;
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

  function setPriority(next: (typeof ALL_TICKET_PRIORITIES)[number]) {
    start(async () => {
      await ticketPriorityAction(ticketId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TicketPriorityBadge priority={priority} />
      <select
        className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs"
        value={priority}
        disabled={pending}
        onChange={(e) => setPriority(e.target.value as (typeof ALL_TICKET_PRIORITIES)[number])}
        aria-label="Ticket priority"
      >
        {ALL_TICKET_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
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
        title="Delete ticket?"
        description="The full conversation and all messages in this ticket will be permanently removed."
        entityName={subject ?? ticketId}
        onDelete={() => deleteTicketAction(ticketId)}
        redirectTo={controlPath("/support")}
      />
    </div>
  );
}
