import { FastLink } from "@/components/ui/fast-link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  trend?: { value: string; positive?: boolean };
  className?: string;
}

export function KpiCard({ label, value, hint, icon: Icon, href, trend, className }: KpiCardProps) {
  const inner = (
    <div className={cn("panel flex h-full flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs tabular-nums",
                trend.positive ? "text-success" : "text-muted-foreground",
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
    </div>
  );

  if (href) return <FastLink href={href} className="block h-full">{inner}</FastLink>;
  return inner;
}
