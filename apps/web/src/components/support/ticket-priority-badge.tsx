import type { TicketPriorityLevel } from "@dior/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ticketPriorityLabel } from "@/lib/ticket-labels";
import { cn } from "@/lib/utils";

const DOT_CLASS: Record<TicketPriorityLevel, string> = {
  LOW: "bg-slate-400",
  NORMAL: "bg-sky-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.55)]",
};

const VARIANT: Record<TicketPriorityLevel, NonNullable<BadgeProps["variant"]>> = {
  LOW: "muted",
  NORMAL: "outline",
  HIGH: "warning",
  URGENT: "destructive",
};

const LEVELS = new Set<string>(["LOW", "NORMAL", "HIGH", "URGENT"]);

export function TicketPriorityBadge({
  priority,
  className,
  showDot = true,
}: {
  priority: string;
  className?: string;
  showDot?: boolean;
}) {
  const level = (LEVELS.has(priority) ? priority : "NORMAL") as TicketPriorityLevel;

  return (
    <Badge variant={VARIANT[level]} className={cn("gap-1.5", className)}>
      {showDot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[level])} /> : null}
      {ticketPriorityLabel(priority)}
    </Badge>
  );
}
