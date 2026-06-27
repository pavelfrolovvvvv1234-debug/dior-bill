"use client";

import { ArrowRight } from "lucide-react";
import { FastLink } from "@/components/ui/fast-link";
import { usePlanProductLines } from "@/lib/i18n/use-plan-lines";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/store";
import type { PlanProductLine } from "@/lib/plan-catalog";
import { PLAN_LINE_TAG_KEYS } from "@/lib/plan-line-tags";

function ServiceCard({ line, bulletproof }: { line: PlanProductLine; bulletproof?: boolean }) {
  const { t } = useI18n();
  const tagKeys = PLAN_LINE_TAG_KEYS[line.id] ?? [];

  return (
    <FastLink
      href={`/plans?tab=${line.id}`}
      className={cn(
        "group relative flex min-h-[168px] flex-col rounded-lg border bg-card p-5",
        "transition-[border-color,background-color] duration-150",
        bulletproof
          ? "border-border hover:border-primary/35 hover:bg-primary/[0.03]"
          : "border-border hover:border-foreground/20 hover:bg-accent/40",
      )}
    >
      {bulletproof ? (
        <span className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-primary/50 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}

      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {line.shortLabel}
          </span>
          {bulletproof ? (
            <span className="rounded border border-primary/25 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary/90">
              BP
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight group-hover:text-primary">
          {line.label}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {line.description}
        </p>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/80 pt-4">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {tagKeys.map((tagKey) => (
            <span
              key={tagKey}
              className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {t(tagKey)}
            </span>
          ))}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground/80 group-hover:text-primary">
          {t("dashboard.catalogConfigure")}
          <ArrowRight
            className="h-3.5 w-3.5 text-muted-foreground"
            strokeWidth={2}
          />
        </span>
      </div>
    </FastLink>
  );
}

function ServiceSection({
  title,
  lines,
  bulletproof = false,
}: {
  title: string;
  lines: PlanProductLine[];
  bulletproof?: boolean;
}) {
  if (lines.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lines.map((line) => (
          <ServiceCard key={line.id} line={line} bulletproof={bulletproof} />
        ))}
      </div>
    </div>
  );
}

export function DashboardServiceCatalog() {
  const { t } = useI18n();
  const lines = usePlanProductLines();
  const bulletproof = lines.filter((l) => l.bulletproof);
  const standard = lines.filter((l) => !l.bulletproof);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("dashboard.addService")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("dashboard.addServiceDesc")}</p>
        </div>
        <FastLink
          href="/plans"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-premium hover:text-foreground"
        >
          {t("dashboard.browseAllPlans")}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </FastLink>
      </div>

      <div className="space-y-8">
        <ServiceSection
          title={t("dashboard.catalogBulletproof")}
          lines={bulletproof}
          bulletproof
        />
        <ServiceSection title={t("dashboard.catalogStandard")} lines={standard} />
      </div>
    </section>
  );
}
