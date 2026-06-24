"use client";

import { deleteTicketAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function TicketRowDelete({ ticketId, subject }: { ticketId: string; subject: string }) {
  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      confirmMessage={`Delete ticket "${subject}" permanently?`}
      onDelete={() => deleteTicketAction(ticketId)}
    />
  );
}
