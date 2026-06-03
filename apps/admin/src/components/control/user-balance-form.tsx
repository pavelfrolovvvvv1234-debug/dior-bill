"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { adjustBalanceAction } from "@/app/actions/user-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";

export function UserBalanceForm({
  userId,
  currentBalance,
  balanceLocked = 0,
}: {
  userId: string;
  currentBalance: number;
  balanceLocked?: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [type, setType] = useState<"credit" | "debit">("credit");
  const balance = Number.isFinite(currentBalance) ? currentBalance : 0;
  const locked = Number.isFinite(balanceLocked) ? balanceLocked : 0;
  const available = Math.max(0, balance - locked);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const fd = new FormData(e.currentTarget);
        const amount = Number(fd.get("amount"));
        const reason = String(fd.get("reason") ?? "").trim();
        const actionType = fd.get("type") as "credit" | "debit";

        if (!Number.isFinite(amount) || amount <= 0) {
          setError("Enter a valid amount greater than 0");
          return;
        }
        if (!reason) {
          setError("Reason is required");
          return;
        }

        start(async () => {
          try {
            await adjustBalanceAction(userId, amount, actionType, reason);
            setSuccess(
              actionType === "credit"
                ? `${formatMoney(amount)} credited to balance`
                : `${formatMoney(amount)} debited from balance`,
            );
            formRef.current?.reset();
            setType("credit");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not adjust balance");
          }
        });
      }}
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        Current balance:{" "}
        <span className="font-medium text-foreground">{formatMoney(balance)}</span>
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs">
          Action
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "credit" | "debit")}
            className="mt-1 block h-9 min-w-[140px] rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm"
          >
            <option value="credit">Add balance</option>
            <option value="debit">Remove balance</option>
          </select>
        </label>

        <label className="text-xs">
          Amount (USD)
          <Input
            name="amount"
            type="number"
            min={0.01}
            step={0.01}
            required
            className="mt-1 w-32"
            placeholder="10.00"
          />
        </label>
      </div>

      <label className="block text-xs">
        Reason
        <Input
          name="reason"
          required
          className="mt-1"
          placeholder="Manual top-up, compensation, correction…"
        />
      </label>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400">
          {success}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Apply adjustment
      </Button>
    </form>
  );
}
