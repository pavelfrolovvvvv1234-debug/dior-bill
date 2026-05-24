"use client";

import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";
import { formatMoney } from "@/lib/utils";

export function PromoSuccessDialog({
  open,
  onOpenChange,
  credit,
  code,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: number;
  code: string;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="promo-success-desc">
        <DialogHeader className="relative pr-12 sm:pr-10">
          <DialogTitle>{t("promo.successTitle")}</DialogTitle>
          <DialogDescription id="promo-success-desc">{t("promo.successMessage")}</DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-premium hover:bg-accent hover:text-foreground"
            aria-label={t("promo.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <DialogBody className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
            <Check className="h-6 w-6 text-success" strokeWidth={2} />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{code}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">+{formatMoney(credit)}</p>
        </DialogBody>

        <DialogFooter className="border-t border-border">
          <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
            {t("promo.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
