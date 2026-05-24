"use client";

import { Plus } from "lucide-react";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";

export function SelectPlanHeaderAction() {
  const { t } = useI18n();

  return (
    <Button size="sm" className="h-8 gap-1.5" asChild>
      <FastLink href="/plans">
        <Plus className="h-3.5 w-3.5" />
        {t("nav.selectPlan")}
      </FastLink>
    </Button>
  );
}
