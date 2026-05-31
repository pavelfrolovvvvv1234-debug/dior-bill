"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  grantCreditsAction,
  refundToBalanceAction,
  setBalanceLockAction,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";

export function WalletControlsForm({
  userId,
  balance,
  balanceLocked,
  credits,
}: {
  userId: string;
  balance: number;
  balanceLocked: number;
  credits: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const available = balance - balanceLocked;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Balance" value={formatMoney(balance)} />
        <Metric label="Locked" value={formatMoney(balanceLocked)} />
        <Metric label="Available" value={formatMoney(available)} highlight />
      </div>

      <form
        className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const lockedAmount = Number(fd.get("lockedAmount"));
          const reason = String(fd.get("lockReason") ?? "").trim();
          start(async () => {
            await setBalanceLockAction(userId, lockedAmount, reason);
            router.refresh();
          });
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Lock balance
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="lockedAmount" type="number" min={0} step={0.01} defaultValue={balanceLocked} placeholder="Locked amount" />
          <Input name="lockReason" required placeholder="Reason for lock" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Update lock
        </Button>
      </form>

      <form
        className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const amount = Number(fd.get("creditAmount"));
          const reason = String(fd.get("creditReason") ?? "").trim();
          start(async () => {
            await grantCreditsAction(userId, amount, reason);
            router.refresh();
          });
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Promo credits · current {formatMoney(credits)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="creditAmount" type="number" min={0.01} step={0.01} required placeholder="Credit amount" />
          <Input name="creditReason" required placeholder="Reason" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Grant credits
        </Button>
      </form>

      <form
        className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const amount = Number(fd.get("refundAmount"));
          const reason = String(fd.get("refundReason") ?? "").trim();
          start(async () => {
            await refundToBalanceAction(userId, amount, reason);
            router.refresh();
          });
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Refund to balance
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="refundAmount" type="number" min={0.01} step={0.01} required placeholder="Refund amount" />
          <Input name="refundReason" required placeholder="Refund reason" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Issue refund
        </Button>
      </form>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
