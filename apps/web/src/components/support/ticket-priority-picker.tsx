"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { CustomerTicketPriority } from "@dior/shared";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

const OPTIONS: {
  id: CustomerTicketPriority;
  icon: typeof Minus;
  titleKey: string;
  descKey: string;
  accent: string;
  ring: string;
}[] = [
  {
    id: "LOW",
    icon: ArrowDown,
    titleKey: "support.priorityLow",
    descKey: "support.priorityLowDesc",
    accent: "text-slate-300",
    ring: "border-slate-500/30 bg-slate-500/5",
  },
  {
    id: "NORMAL",
    icon: Minus,
    titleKey: "support.priorityNormal",
    descKey: "support.priorityNormalDesc",
    accent: "text-sky-300",
    ring: "border-sky-500/30 bg-sky-500/5",
  },
  {
    id: "HIGH",
    icon: ArrowUp,
    titleKey: "support.priorityHigh",
    descKey: "support.priorityHighDesc",
    accent: "text-amber-300",
    ring: "border-amber-500/35 bg-amber-500/8",
  },
];

export function TicketPriorityPicker({
  value,
  onChange,
  name = "priority",
}: {
  value?: CustomerTicketPriority;
  onChange?: (value: CustomerTicketPriority) => void;
  name?: string;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CustomerTicketPriority>(value ?? "NORMAL");

  function select(id: CustomerTicketPriority) {
    setSelected(id);
    onChange?.(id);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium">{t("support.priority")}</label>
        <span className="text-xs text-muted-foreground">{t("support.priorityHint")}</span>
      </div>

      <input type="hidden" name={name} value={selected} />

      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => select(option.id)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-premium",
                active
                  ? cn(option.ring, "ring-1 ring-inset ring-white/10")
                  : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border border-white/8 bg-black/20",
                    active && option.accent,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="text-sm font-medium">{t(option.titleKey)}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(option.descKey)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
