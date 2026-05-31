"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import {
  approveTopUpAction,
  forceCompleteTopUpAction,
  rejectTopUpAction,
  syncTopUpAction,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function TopUpActions({
  topUpId,
  status,
}: {
  topUpId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const refresh = () => router.refresh();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "MANUAL_REVIEW" && (
        <>
          <Button
            type="button"
            size="sm"
            disabled={!!pending}
            className="gap-1.5"
            onClick={() => start(async () => { await approveTopUpAction(topUpId); refresh(); })}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!!pending}
            className="gap-1.5"
            onClick={() => {
              const reason = prompt("Rejection reason:");
              if (!reason) return;
              start(async () => { await rejectTopUpAction(topUpId, reason); refresh(); });
            }}
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </Button>
        </>
      )}

      {!["PAID", "REFUNDED"].includes(status) && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!pending}
            className="gap-1.5"
            onClick={() => start(async () => { await syncTopUpAction(topUpId); refresh(); })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync provider
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!pending}
            className="gap-1.5"
            onClick={() => start(async () => { await forceCompleteTopUpAction(topUpId, "Force completed by admin"); refresh(); })}
          >
            <Zap className="h-3.5 w-3.5" />
            Force complete
          </Button>
        </>
      )}

      {status === "PAID" && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Settled
        </span>
      )}
    </div>
  );
}
