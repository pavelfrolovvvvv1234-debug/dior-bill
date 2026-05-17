"use client";

import { Check, Zap, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopUpProviderMeta } from "@dior/shared";
import { PaymentProviderIcon } from "./payment-provider-icons";

interface PaymentMethodCardProps {
  provider: TopUpProviderMeta;
  selected: boolean;
  onSelect: () => void;
}

export function PaymentMethodCard({ provider, selected, onSelect }: PaymentMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-lg border p-4 text-left transition-enterprise",
        "bg-card",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/30 hover:bg-muted/30",
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <PaymentProviderIcon id={provider.id} />
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-semibold tracking-tight">{provider.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{provider.description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {provider.methods.map((m) => (
          <span
            key={m}
            className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {m}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {provider.speed}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {provider.feePercent === 0 ? "No fee" : `${provider.feePercent}% fee`}
        </span>
        {provider.id === "MANUAL_TRANSFER" && (
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>
    </button>
  );
}
