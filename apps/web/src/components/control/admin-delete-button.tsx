"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOptimisticRowRemove } from "@/components/control/row-delete-context";
import { cn } from "@/lib/utils";

type AdminDeleteButtonProps = {
  title: string;
  description: string;
  entityName?: string;
  confirmLabel?: string;
  onDelete: () => Promise<void>;
  redirectTo?: string;
  label?: string;
  variant?: "destructive" | "ghost";
  className?: string;
};

export function AdminDeleteButton({
  title,
  description,
  entityName,
  confirmLabel = "Delete permanently",
  onDelete,
  redirectTo,
  label = "Delete",
  variant = "destructive",
  className,
}: AdminDeleteButtonProps) {
  const router = useRouter();
  const removeRow = useOptimisticRowRemove();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    setOpen(true);
  }

  function handleConfirm() {
    start(async () => {
      try {
        await onDelete();
        setOpen(false);
        removeRow?.();
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        className={cn("gap-1.5", className)}
        onClick={handleOpen}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className={cn("h-3.5 w-3.5", variant === "ghost" && "text-red-400")} />
        )}
        {label || null}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent
          className="max-w-[440px] border-red-500/15 bg-[#0a0f18]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="border-red-500/10">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-base">{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {entityName ? (
              <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Target
                </p>
                <p className="mt-1 truncate font-medium text-foreground">{entityName}</p>
              </div>
            ) : null}

            <p className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2.5 text-xs leading-relaxed text-red-200/90">
              This action is permanent and cannot be undone.
            </p>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </DialogBody>

          <DialogFooter className="flex-row justify-end gap-2 border-t border-white/8 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className="text-[var(--muted-foreground)] hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              className="min-w-[9rem] gap-1.5 bg-red-600 hover:bg-red-500"
              onClick={handleConfirm}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
