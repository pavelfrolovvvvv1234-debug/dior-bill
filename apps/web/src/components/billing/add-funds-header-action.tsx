"use client";

import { Plus } from "lucide-react";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";

export function AddFundsHeaderAction() {
  const { t } = useI18n();

  return (
    <Button size="sm" className="h-8 gap-1.5" asChild>
      <FastLink href="/billing/topup">
        <Plus className="h-3.5 w-3.5" />
        {t("common.addFunds")}
      </FastLink>
    </Button>
  );
}
