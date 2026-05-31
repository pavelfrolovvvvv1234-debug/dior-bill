"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { invoiceOverrideAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(action: "mark_paid" | "void" | "extend") {
    start(async () => {
      await invoiceOverrideAction(invoiceId, action);
      router.refresh();
    });
  }

  if (status === "PAID" || status === "CANCELLED") {
    return <p className="text-xs text-[var(--muted-foreground)]">No actions available</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        className="gap-1.5"
        onClick={() => run("mark_paid")}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Mark paid
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        className="gap-1.5"
        onClick={() => run("extend")}
      >
        <Clock className="h-3.5 w-3.5" />
        Extend 7d
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        className="gap-1.5"
        onClick={() => run("void")}
      >
        <XCircle className="h-3.5 w-3.5" />
        Void
      </Button>
    </div>
  );
}
