"use client";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import type { VpsPlan } from "@/lib/vps-plans";
import { cn } from "@/lib/utils";

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function VpsPlanCard({
  plan,
  selected,
  onSelect,
  detailed = false,
}: {
  plan: VpsPlan;
  selected: boolean;
  onSelect: () => void;
  detailed?: boolean;
}) {
  const isTurbovds = plan.display === "turbovds";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col rounded-lg border p-4 text-left transition-premium",
        selected
          ? "border-primary/40 bg-primary/5 shadow-[0_0_24px_rgba(59,130,246,0.08)]"
          : "border-white/6 bg-white/[0.02] hover:border-white/12",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{plan.name}</span>
        {plan.popular && <Badge variant="muted">Popular</Badge>}
      </div>

      {detailed && isTurbovds ? (
        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <SpecRow label="CPU" value={`${plan.cpuCores} cores`} />
          <SpecRow label="RAM (DDR5)" value={plan.ramDisplay ?? `${plan.ramMb / 1024} GB`} />
          <SpecRow label="NVMe" value={plan.diskDisplay ?? `${plan.diskGb} GB`} />
          <SpecRow label="Network" value={plan.networkDisplay ?? `${plan.networkMbps} Mbps`} />
          <SpecRow label="Port" value={plan.portDisplay ?? "—"} />
          <SpecRow label="PPS" value={plan.ppsDisplay ?? "—"} />
          <SpecRow label="Bandwidth" value={plan.bandwidthLabel} />
        </div>
      ) : detailed ? (
        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <SpecRow label="CPU" value={`${plan.cpuCores} core${plan.cpuCores > 1 ? "s" : ""}`} />
          <SpecRow label="RAM" value={`${plan.ramMb / 1024} GB`} />
          <SpecRow label="SSD" value={`${plan.diskGb} GB`} />
          <SpecRow label="Network" value={`${plan.networkMbps} Mbps`} />
          <SpecRow label="Bandwidth" value={plan.bandwidthLabel} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {plan.cpuCores} vCPU · {plan.ramMb / 1024} GB RAM · {plan.diskGb} GB SSD
        </p>
      )}

      <p className={cn("font-semibold tabular-nums", detailed ? "mt-4 text-xl" : "mt-3 text-lg")}>
        {formatMoney(plan.price)}
        <span className="text-xs font-normal text-muted-foreground">/mo</span>
      </p>
    </button>
  );
}
