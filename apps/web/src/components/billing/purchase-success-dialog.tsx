"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const STEP_KEYS = [
  "purchase.provisionStep1",
  "purchase.provisionStep2",
  "purchase.provisionStep3",
  "purchase.provisionStep4",
] as const;

const STEP_MS = 680;
const SUCCESS_DELAY_MS = 420;

type Phase = "provisioning" | "success";

function ProvisioningOrb() {
  return (
    <div className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-primary/10 provision-pulse-ring" />
      <div
        className="absolute inset-1 rounded-full border border-primary/20 provision-orbit"
        style={{ borderTopColor: "color-mix(in srgb, var(--primary) 70%, transparent)" }}
      />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/35 bg-primary/12 shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_22%,transparent)]">
        <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={2} />
      </div>
    </div>
  );
}

function ProvisioningSteps({ activeStep }: { activeStep: number }) {
  const { t } = useI18n();

  return (
    <ul className="space-y-2.5 text-left">
      {STEP_KEYS.map((key, index) => {
        const done = index < activeStep;
        const current = index === activeStep;
        const pending = index > activeStep;

        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-300",
              done && "border-primary/20 bg-primary/[0.06]",
              current && "border-primary/35 bg-primary/[0.08] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]",
              pending && "border-border/60 bg-transparent opacity-55",
              (done || current) && "provision-step-in",
            )}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                done && "border-primary/40 bg-primary/15 text-primary",
                current && "border-primary/50 bg-primary/20 text-primary",
                pending && "border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm leading-snug",
                done && "text-foreground/90",
                current && "font-medium text-foreground",
                pending && "text-muted-foreground",
              )}
            >
              {t(key)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
  const [phase, setPhase] = useState<Phase>("provisioning");
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setPhase("provisioning");
      setActiveStep(0);
      return;
    }

    setPhase("provisioning");
    setActiveStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= STEP_KEYS.length; i++) {
      timers.push(
        setTimeout(() => {
          setActiveStep(i);
        }, STEP_MS * i),
      );
    }

    timers.push(
      setTimeout(() => {
        setPhase("success");
      }, STEP_MS * STEP_KEYS.length + SUCCESS_DELAY_MS),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [open]);

  const progress =
    phase === "success"
      ? 100
      : Math.min(96, Math.round((activeStep / STEP_KEYS.length) * 100));

  function handleOpenChange(next: boolean) {
    if (!next && phase === "provisioning") return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={phase === "provisioning" ? "purchase-provision-desc" : "purchase-success-desc"}
        onPointerDownOutside={(e) => {
          if (phase === "provisioning") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === "provisioning") e.preventDefault();
        }}
        className="max-w-[26rem] overflow-hidden"
      >
        {phase === "provisioning" ? (
          <>
            <DialogHeader className="border-b-0 pb-0 text-center">
              <DialogTitle>{t("purchase.provisionTitle")}</DialogTitle>
              <DialogDescription id="purchase-provision-desc" className="mx-auto max-w-[18rem]">
                {t("purchase.provisionSubtitle")}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-5 pt-2">
              <ProvisioningOrb />
              <ProvisioningSteps activeStep={activeStep} />

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{t("purchase.provisionProgress")}</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                  <div className="provision-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                </div>
              </div>
            </DialogBody>
          </>
        ) : (
          <>
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
              <div className="provision-success-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_32px_color-mix(in_srgb,var(--primary)_18%,transparent)]">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
