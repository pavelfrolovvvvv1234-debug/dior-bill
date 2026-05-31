"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createManualInvoiceAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateInvoiceForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const id = await createManualInvoiceAction(userId, {
            description: String(fd.get("description") ?? ""),
            amount: Number(fd.get("amount")),
            dueInDays: Number(fd.get("dueInDays") ?? 7),
            notes: String(fd.get("notes") ?? "") || undefined,
          });
          router.push(`/control/billing/invoices/${id}`);
          router.refresh();
        });
      }}
    >
      <Input name="description" required placeholder="Line item description" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="amount" type="number" min={0.01} step={0.01} required placeholder="Amount USD" />
        <Input name="dueInDays" type="number" min={1} defaultValue={7} placeholder="Due in days" />
      </div>
      <Input name="notes" placeholder="Internal notes (optional)" />
      <Button type="submit" size="sm" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create invoice
      </Button>
    </form>
  );
}
