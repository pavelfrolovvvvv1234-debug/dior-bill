"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, TicketPercent, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { redeemPromoCodeAction } from "@/app/actions/promo";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

interface PromoCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: { credit: number; code: string }) => void;
}

export function PromoCodeDialog({ open, onOpenChange, onSuccess }: PromoCodeDialogProps) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t("promo.enterCode"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await redeemPromoCodeAction(trimmed);
      onOpenChange(false);
      onSuccess({ credit: result.credit, code: result.code });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("promo.errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="promo-dialog-desc">
        <DialogHeader className="relative pr-10">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <TicketPercent className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <DialogTitle>{t("promo.title")}</DialogTitle>
          <DialogDescription id="promo-dialog-desc">{t("promo.description")}</DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-premium hover:bg-white/5 hover:text-foreground"
            aria-label={t("promo.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="promo-code"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {t("promo.codeLabel")}
              </label>
              <div className="relative">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
                <Input
                  id="promo-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="DIOR2026"
                  autoComplete="off"
                  autoFocus
                  className={cn(
                    "h-12 border-white/10 bg-white/[0.04] pl-10 font-mono text-base uppercase tracking-[0.2em]",
                    "focus-glow placeholder:tracking-normal placeholder:font-sans placeholder:normal-case",
                  )}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter className="border-t border-white/6 bg-white/[0.02]">
            <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("promo.checking")}
                </>
              ) : (
                t("promo.apply")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
