"use client";

import Link from "next/link";
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

export function PurchaseSuccessDialog({
  open,
  onOpenChange,
  servicesHref = "/services",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicesHref?: string;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="purchase-success-desc">
        <DialogHeader className="relative pr-10">
          <DialogTitle>{t("purchase.successTitle")}</DialogTitle>
          <DialogDescription id="purchase-success-desc">
            {t("purchase.successMessage")}
          </DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-premium hover:bg-white/5 hover:text-foreground"
            aria-label={t("purchase.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <DialogBody className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Check className="h-7 w-7 text-primary" strokeWidth={2.5} />
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-white/6 bg-white/[0.02] sm:flex-col sm:gap-2">
          <Button type="button" className="w-full" asChild>
            <Link href={servicesHref} onClick={() => onOpenChange(false)}>
              {t("purchase.goToServices")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("purchase.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
