"use client";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import type { VpsPlan } from "@/lib/vps-plans";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/store";

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
  const { t } = useI18n();
  const isTurbovds = plan.display === "turbovds";
  const bandwidth = plan.bandwidthLabel === "Unlimited" ? t("plans.unlimited") : plan.bandwidthLabel;
  const perMonth = t("plans.perMonth");
  const cpuLabel = t(plan.cpuCores > 1 ? "plans.spec.cpuCores" : "plans.spec.cpuCore", {
    count: plan.cpuCores,
  });

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
        {plan.popular && <Badge variant="muted">{t("plans.popular")}</Badge>}
      </div>

      {detailed && isTurbovds ? (
        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <SpecRow label={t("plans.spec.cpu")} value={cpuLabel} />
          <SpecRow
            label={t("plans.spec.ramDdr5")}
            value={plan.ramDisplay ?? t("plans.spec.gb", { value: plan.ramMb / 1024 })}
          />
          <SpecRow
            label={t("plans.spec.nvme")}
            value={plan.diskDisplay ?? t("plans.spec.gb", { value: plan.diskGb })}
          />
          <SpecRow
            label={t("plans.spec.network")}
            value={plan.networkDisplay ?? t("plans.spec.networkMbps", { mbps: plan.networkMbps })}
          />
          <SpecRow label={t("plans.spec.port")} value={plan.portDisplay ?? "—"} />
          <SpecRow label={t("plans.spec.pps")} value={plan.ppsDisplay ?? "—"} />
          <SpecRow label={t("plans.spec.bandwidth")} value={bandwidth} />
        </div>
      ) : detailed ? (
        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <SpecRow label={t("plans.spec.cpu")} value={cpuLabel} />
          <SpecRow label={t("plans.spec.ram")} value={t("plans.spec.gb", { value: plan.ramMb / 1024 })} />
          <SpecRow label={t("plans.spec.ssd")} value={t("plans.spec.gb", { value: plan.diskGb })} />
          <SpecRow label={t("plans.spec.network")} value={t("plans.spec.networkMbps", { mbps: plan.networkMbps })} />
          <SpecRow label={t("plans.spec.bandwidth")} value={bandwidth} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("plans.spec.vcpuSummary", {
            cpu: plan.cpuCores,
            ram: plan.ramMb / 1024,
            disk: plan.diskGb,
          })}
        </p>
      )}

      <p className={cn("font-semibold tabular-nums", detailed ? "mt-4 text-xl" : "mt-3 text-lg")}>
        {formatMoney(plan.price)}
        <span className="text-xs font-normal text-muted-foreground">{perMonth}</span>
      </p>
    </button>
  );
}
