"use client";

import { deleteTicketAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function TicketRowDelete({ ticketId, subject }: { ticketId: string; subject: string }) {
  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      title="Delete ticket?"
      description="The full conversation and all messages in this ticket will be permanently removed."
      entityName={subject}
      onDelete={() => deleteTicketAction(ticketId)}
    />
  );
}
