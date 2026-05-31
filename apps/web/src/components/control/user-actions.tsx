"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  activateUserAction,
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
  const router = useRouter();
  const [pending, start] = useTransition();

  const refresh = () => router.refresh();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await suspendUserAction(userId, "Admin action");
              refresh();
            })
          }
        >
          Suspend
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await activateUserAction(userId);
              refresh();
            })
          }
        >
          Activate
        </Button>
      )}
      <select
        className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs"
        value={role}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await updateRoleAction(userId, e.target.value);
            refresh();
          })
        }
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
