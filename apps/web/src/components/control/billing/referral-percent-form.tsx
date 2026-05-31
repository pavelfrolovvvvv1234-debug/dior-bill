"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateReferralPercentAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralPercentForm({
  userId,
  currentPercent,
}: {
  userId: string;
  currentPercent: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const raw = String(fd.get("percent") ?? "").trim();
        const percent = raw === "" ? null : Number(raw);
        start(async () => {
          await updateReferralPercentAction(userId, percent);
          router.refresh();
        });
      }}
    >
      <label className="text-xs">
        Custom referral %
        <Input
          name="percent"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={currentPercent ?? ""}
          placeholder="Default"
          className="mt-1 w-28"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}
