"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminDeleteButtonProps = {
  confirmMessage: string;
  onDelete: () => Promise<void>;
  redirectTo?: string;
  label?: string;
  variant?: "destructive" | "ghost";
  className?: string;
};

export function AdminDeleteButton({
  confirmMessage,
  onDelete,
  redirectTo,
  label = "Delete",
  variant = "destructive",
  className,
}: AdminDeleteButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      className={cn("gap-1.5", className)}
      onClick={() => {
        if (!confirm(confirmMessage)) return;
        start(async () => {
          try {
            await onDelete();
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Delete failed");
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className={cn("h-3.5 w-3.5", variant === "ghost" && "text-red-400")} />
      )}
      {label || null}
    </Button>
  );
}
