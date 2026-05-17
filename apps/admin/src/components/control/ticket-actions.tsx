"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ticketStatusAction } from "@/app/actions/control";

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs"
      value={status}
      disabled={pending}
      onChange={(e) => start(() => ticketStatusAction(ticketId, e.target.value as import("@dior/database").TicketStatus))}
    >
      {["OPEN", "AWAITING_STAFF", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
