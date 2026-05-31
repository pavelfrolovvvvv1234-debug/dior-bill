"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { deletePromoAction, togglePromoAction } from "@/app/actions/control";
import { Button } from "@/components/ui/button";

export function PromoRowActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => start(async () => { await togglePromoAction(id, !active); router.refresh(); })}
      >
        {active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this promo code?")) return;
          start(async () => { await deletePromoAction(id); router.refresh(); });
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-400" />}
      </Button>
    </div>
  );
}
