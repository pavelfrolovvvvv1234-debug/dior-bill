"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPromoAction } from "@/app/actions/control";

export function PromoCreateForm() {
  const [pending, start] = useTransition();

  return (
    <form
      className="panel flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(() =>
          createPromoAction({
            code: String(fd.get("code")),
            discountType: fd.get("type") as "percent" | "fixed",
            discountValue: Number(fd.get("value")),
          }),
        );
      }}
    >
      <label className="text-xs">
        Code
        <Input name="code" className="mt-1 w-32" required />
      </label>
      <label className="text-xs">
        Type
        <select name="type" className="mt-1 h-9 rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm">
          <option value="percent">Percent</option>
          <option value="fixed">Fixed</option>
        </select>
      </label>
      <label className="text-xs">
        Value
        <Input name="value" type="number" className="mt-1 w-24" required />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Create
      </Button>
    </form>
  );
}
