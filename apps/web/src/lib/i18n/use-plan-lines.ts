"use client";

import { PLAN_PRODUCT_LINES_VISIBLE, type PlanProductLine } from "@/lib/plan-catalog";
import { useI18n } from "./store";

export function usePlanProductLines(): PlanProductLine[] {
  const { t } = useI18n();

  return PLAN_PRODUCT_LINES_VISIBLE.map((line) => ({
    ...line,
    label: t(`plans.lines.${line.id}.label`),
    shortLabel: t(`plans.lines.${line.id}.short`),
    description: t(`plans.lines.${line.id}.desc`),
  }));
}

export function usePlanLineLabel(id: string): string {
  const { t } = useI18n();
  return t(`plans.lines.${id}.label`);
}
