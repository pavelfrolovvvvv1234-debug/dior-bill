"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full max-w-full flex-wrap gap-1 rounded-lg border border-white/6 bg-white/[0.02] p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-premium sm:text-sm",
              active
                ? "bg-white/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}