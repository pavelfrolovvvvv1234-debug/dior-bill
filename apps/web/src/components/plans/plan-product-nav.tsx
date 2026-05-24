"use client";

import { cn } from "@/lib/utils";
import type { PlanProductLine, PlanTab } from "@/lib/plan-catalog";
import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n/store";

interface PlanProductNavProps {
  lines: PlanProductLine[];
  value: PlanTab;
  onChange: (id: PlanTab) => void;
}

/** Fixed layout so all 6 tabs stay the same size when switching (no grid jump). */
const TAB_BUTTON_CLASS =
  "flex h-[5.75rem] w-full flex-col rounded-lg border px-4 py-3 text-left transition-colors duration-150";

export function PlanProductNav({ lines, value, onChange }: PlanProductNavProps) {
  const { t } = useI18n();

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      role="tablist"
      aria-label={t("plans.productNav")}
    >
      {lines.map((line) => {
        const active = line.id === value;
        return (
          <button
            key={line.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(line.id)}
            className={cn(
              TAB_BUTTON_CLASS,
              active
                ? "border-primary/40 bg-primary/5 ring-1 ring-inset ring-primary/25"
                : "border-white/6 bg-white/[0.02] ring-1 ring-inset ring-transparent hover:border-white/12 hover:bg-white/[0.04]",
            )}
          >
            <div className="flex min-h-[2.5rem] items-start justify-between gap-2">
              <span className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">
                {line.label}
              </span>
              <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {line.bulletproof ? (
                  <Shield
                    className="h-3.5 w-3.5 text-primary"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                ) : null}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-muted-foreground">
              {line.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
