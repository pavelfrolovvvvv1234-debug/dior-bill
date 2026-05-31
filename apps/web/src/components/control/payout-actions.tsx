"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { markPayoutPaidAction } from "@/app/actions/billing";
import { payoutStatusAction } from "@/app/actions/control";
import { Button } from "@/components/ui/button";

export function PayoutActions({
  payoutId,
  status,
}: {
  payoutId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = () => router.refresh();

  if (status === "PAID" || status === "REJECTED") {
    return <span className="text-xs text-[var(--muted-foreground)]">{status}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="gap-1"
        onClick={() => start(async () => { await payoutStatusAction(payoutId, "APPROVED"); refresh(); })}
      >
        Approve
      </Button>
      {status === "APPROVED" && (
        <Button
          size="sm"
          disabled={pending}
          className="gap-1"
          onClick={() => start(async () => { await markPayoutPaidAction(payoutId); refresh(); })}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Mark paid
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        className="gap-1"
        onClick={() => start(async () => { await payoutStatusAction(payoutId, "REJECTED"); refresh(); })}
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
