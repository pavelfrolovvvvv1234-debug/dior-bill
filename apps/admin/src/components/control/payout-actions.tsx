"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { payoutStatusAction } from "@/app/actions/control";

export function PayoutActions({ payoutId }: { payoutId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => payoutStatusAction(payoutId, "APPROVED"))}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(() => payoutStatusAction(payoutId, "REJECTED"))}>
        Reject
      </Button>
    </div>
  );
}
