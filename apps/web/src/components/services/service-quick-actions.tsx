"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { createRenewalInvoiceAction } from "@/app/actions/service-billing";
import { useI18n } from "@/lib/i18n/store";

interface ServiceQuickActionsProps {
  manageHref: string;
  serviceId: string;
  vpsId?: string;
  canRenew?: boolean;
  canUpgrade?: boolean;
}

export function ServiceQuickActions({
  manageHref,
  serviceId,
  vpsId,
  canRenew = false,
  canUpgrade = false,
}: ServiceQuickActionsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRenew() {
    setError(null);
    startTransition(async () => {
      try {
        const invoiceId = await createRenewalInvoiceAction(serviceId);
        router.push(`/billing/invoices/${invoiceId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("services.renewFailed"));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="default" size="sm" className="h-8" asChild>
        <FastLink href={manageHref}>{t("services.manage")}</FastLink>
      </Button>
      {canRenew && (
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 lg:inline-flex"
          disabled={pending}
          onClick={handleRenew}
        >
          {t("services.renew")}
        </Button>
      )}
      {canUpgrade && vpsId && (
        <Button variant="ghost" size="sm" className="hidden h-8 xl:inline-flex" asChild>
          <FastLink href={`/vps/${vpsId}/upgrade`}>{t("services.upgrade")}</FastLink>
        </Button>
      )}
      {error && <p className="w-full text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
