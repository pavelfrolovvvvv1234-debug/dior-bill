import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const inner = (
    <div className="panel p-5 transition-colors hover:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-primary/70" strokeWidth={1.5} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>}
      {trend && (
        <p
          className={cn(
            "mt-2 text-xs",
            trend === "up" && "text-[var(--success)]",
            trend === "down" && "text-[var(--destructive)]",
          )}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"} vs last period
        </p>
      )}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
