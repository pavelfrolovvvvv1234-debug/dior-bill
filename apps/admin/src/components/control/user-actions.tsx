"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  activateUserAction,
  adjustBalanceAction,
  suspendUserAction,
  updateRoleAction,
} from "@/app/actions/control";

export function UserActions({
  userId,
  status,
  role,
}: {
  userId: string;
  status: string;
  role: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => start(() => suspendUserAction(userId, "Admin action"))}
        >
          Suspend
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => start(() => activateUserAction(userId))}>
          Activate
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const amount = prompt("Credit amount (USD):");
          if (!amount) return;
          start(() => adjustBalanceAction(userId, Number(amount), "credit", "Admin credit"));
        }}
      >
        Credit balance
      </Button>
      <select
        className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs"
        value={role}
        disabled={pending}
        onChange={(e) => start(() => updateRoleAction(userId, e.target.value))}
      >
        {["USER", "SUPPORT", "OPERATOR", "ADMIN", "SUPER_ADMIN", "AFFILIATE_VIP"].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
