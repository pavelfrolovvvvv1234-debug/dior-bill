"use client";

import { useEffect, useState } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
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
import { getPromoErrorMessage } from "@/lib/promo-errors";
import { normalizePromoActionError } from "@/lib/promo-action-error";

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
      if (!result.ok) {
        setError(getPromoErrorMessage(result.error, t));
        return;
      }

      onOpenChange(false);
      onSuccess({ credit: result.credit, code: result.code });
    } catch (err) {
      setError(getPromoErrorMessage(normalizePromoActionError(err), t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="promo-dialog-desc">
        <DialogHeader className="relative pr-12 sm:pr-10">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
            <TicketPercent className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <DialogTitle>{t("promo.title")}</DialogTitle>
          <DialogDescription id="promo-dialog-desc">{t("promo.description")}</DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-premium hover:bg-accent hover:text-foreground"
            aria-label={t("promo.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="promo-code" className="text-sm font-medium">
                {t("promo.codeLabel")}
              </label>
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DIOR2026"
                autoComplete="off"
                autoFocus
                className="font-mono uppercase tracking-[0.12em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter className="border-t border-border">
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
