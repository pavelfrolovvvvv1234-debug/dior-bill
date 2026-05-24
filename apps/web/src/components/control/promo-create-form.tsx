"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPromoAction } from "@/app/actions/control";
import type { PromoDiscountType } from "@dior/shared";

const TYPE_OPTIONS: {
  value: PromoDiscountType;
  label: string;
  hint: string;
  valueLabel: string;
  min: number;
  max: number;
  step: string;
}[] = [
  {
    value: "fixed",
    label: "Balance credit",
    hint: "Credits a fixed USD amount to the user's billing balance when they apply the code.",
    valueLabel: "Amount (USD)",
    min: 0.01,
    max: 100000,
    step: "0.01",
  },
  {
    value: "percent",
    label: "Order discount",
    hint: "Percent off the order total at checkout (VPS deploy, plan purchases). Not credited via the balance promo dialog.",
    valueLabel: "Discount (%)",
    min: 1,
    max: 100,
    step: "1",
  },
];

export function PromoCreateForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<PromoDiscountType>("fixed");
  const selected = TYPE_OPTIONS.find((o) => o.value === discountType) ?? TYPE_OPTIONS[0];

  return (
    <form
      className="panel space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const maxUsesRaw = String(fd.get("maxUses") ?? "").trim();
        const form = e.currentTarget;
        start(async () => {
          try {
            await createPromoAction({
              code: String(fd.get("code")),
              discountType: fd.get("type") as PromoDiscountType,
              discountValue: Number(fd.get("value")),
              maxUses: maxUsesRaw ? Number(maxUsesRaw) : undefined,
            });
            form.reset();
            setDiscountType("fixed");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create promo code");
          }
        });
      }}
    >
      <div>
        <p className="text-sm font-medium text-foreground">Create promo code</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Choose whether the code adds balance credit or discounts an order at checkout.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Code
          <Input
            name="code"
            className="mt-1 w-36 font-mono uppercase"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            placeholder="DIOR10"
            autoComplete="off"
          />
        </label>

        <label className="text-xs">
          Type
          <select
            name="type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
            className="mt-1 block h-9 min-w-[180px] rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          {selected.valueLabel}
          <Input
            name="value"
            type="number"
            className="mt-1 w-28"
            required
            min={selected.min}
            max={selected.max}
            step={selected.step}
            key={discountType}
          />
        </label>

        <label className="text-xs">
          Max uses
          <Input
            name="maxUses"
            type="number"
            className="mt-1 w-24"
            min={1}
            step={1}
            placeholder="∞"
          />
        </label>

        <Button type="submit" size="sm" disabled={pending} className="mb-0.5">
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">{selected.hint}</p>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
