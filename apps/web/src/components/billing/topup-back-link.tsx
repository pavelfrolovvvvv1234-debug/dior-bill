"use client";

import { ArrowLeft } from "lucide-react";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";

export function TopUpBackLink() {
  const { t } = useI18n();

  return (
    <Button variant="ghost" size="sm" className="mb-4 -ml-1 h-8 sm:mb-6 sm:-ml-2" asChild>
      <FastLink href="/billing/topup">
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t("pages.paymentStatus.backToTopup")}
      </FastLink>
    </Button>
  );
}
