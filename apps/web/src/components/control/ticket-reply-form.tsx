"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminReplyTicketAction } from "@/app/actions/control";
import { controlPath } from "@/lib/control-paths";
import { Button } from "@/components/ui/button";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        start(async () => {
          await adminReplyTicketAction(ticketId, formData);
          formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <textarea
        name="body"
        required
        rows={5}
        disabled={pending}
        placeholder="Reply to the customer…"
        className="flex w-full rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
      <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <input type="checkbox" name="internal" className="rounded border-white/20" />
        Internal note (visible to staff only)
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={controlPath("/support")}>Back to tickets</Link>
        </Button>
      </div>
    </form>
  );
}
