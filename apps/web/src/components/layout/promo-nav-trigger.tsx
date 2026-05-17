"use client";

import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { cn } from "@/lib/utils";
import { PromoCodeDialog } from "@/components/billing/promo-code-dialog";
import { PromoSuccessDialog } from "@/components/billing/promo-success-dialog";
import { useI18n } from "@/lib/i18n/store";

export function PromoNavTrigger({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState<{ credit: number; code: string } | null>(null);

  const label = t("nav.promoCodes");

  function handleOpen() {
    onNavigate?.();
    setFormOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-premium",
          formOpen || success
            ? "nav-item-active"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        <TicketPercent className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        {!collapsed && <span>{label}</span>}
      </button>
      <PromoCodeDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={(result) => setSuccess(result)}
      />
      {success && (
        <PromoSuccessDialog
          open
          credit={success.credit}
          code={success.code}
          onOpenChange={(open) => {
            if (!open) setSuccess(null);
          }}
        />
      )}
    </>
  );
}
