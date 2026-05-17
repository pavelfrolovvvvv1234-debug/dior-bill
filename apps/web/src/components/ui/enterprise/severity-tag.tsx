import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "high" | "warning" | "info" | "low";

const styles: Record<SeverityLevel, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  low: "border-white/10 bg-white/5 text-muted-foreground",
};

export function normalizeSeverity(raw: string): SeverityLevel {
  const s = raw.toLowerCase();
  if (s === "critical" || s === "error" || s === "outage") return "critical";
  if (s === "high") return "high";
  if (s === "warning" || s === "degraded") return "warning";
  if (s === "info" || s === "success") return "info";
  return "low";
}

export function SeverityTag({
  severity,
  label,
  className,
}: {
  severity: SeverityLevel | string;
  label?: string;
  className?: string;
}) {
  const level = typeof severity === "string" ? normalizeSeverity(severity) : severity;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[level],
        className,
      )}
    >
      {label ?? level}
    </span>
  );
}
