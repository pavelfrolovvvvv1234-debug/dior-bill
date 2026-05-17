import { cn } from "@/lib/utils";

type StatusLevel = "operational" | "degraded" | "outage" | "provisioning" | "stopped" | "unknown";

const config: Record<StatusLevel, { label: string; dot: string; text: string }> = {
  operational: { label: "Operational", dot: "bg-emerald-500", text: "text-emerald-500" },
  degraded: { label: "Degraded", dot: "bg-amber-500", text: "text-amber-500" },
  outage: { label: "Outage", dot: "bg-red-500", text: "text-red-500" },
  provisioning: { label: "Provisioning", dot: "bg-sky-400", text: "text-sky-400" },
  stopped: { label: "Stopped", dot: "bg-zinc-500", text: "text-zinc-400" },
  unknown: { label: "Unknown", dot: "bg-zinc-600", text: "text-muted-foreground" },
};

interface StatusIndicatorProps {
  status: StatusLevel;
  label?: string;
  showLabel?: boolean;
  pulse?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  showLabel = true,
  pulse = false,
  className,
}: StatusIndicatorProps) {
  const c = config[status] ?? config.unknown;
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium", className)}>
      <span className="relative flex h-2 w-2">
        {pulse && status === "operational" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-40", c.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      {showLabel && <span className={cn(c.text)}>{label ?? c.label}</span>}
    </span>
  );
}

export function mapServiceStatus(status: string): StatusLevel {
  const s = status.toUpperCase();
  if (["ACTIVE", "RUNNING", "PAID"].includes(s)) return "operational";
  if (["PROVISIONING", "PENDING", "PROCESSING"].includes(s)) return "provisioning";
  if (["SUSPENDED", "STOPPED", "FAILED"].includes(s)) return s === "FAILED" ? "outage" : "stopped";
  if (["EXPIRED", "CANCELLED", "DELETED"].includes(s)) return "stopped";
  if (["DEGRADED", "PAST_DUE"].includes(s)) return "degraded";
  return "unknown";
}
