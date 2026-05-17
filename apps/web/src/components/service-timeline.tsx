"use client";

import { CheckCircle2, Circle, AlertCircle, Rocket, RefreshCw, Pause } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  severity: string;
  createdAt: Date;
}

const iconForType: Record<string, typeof Circle> = {
  ordered: Rocket,
  deployed: CheckCircle2,
  renewed: RefreshCw,
  upgraded: RefreshCw,
  suspended: Pause,
  provision_failed: AlertCircle,
};

export function ServiceTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-border/60 pl-6">
      {events.map((event) => {
        const Icon = iconForType[event.type] ?? Circle;
        const isError = event.severity === "error";
        return (
          <li key={event.id} className="relative pb-8 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.65rem] flex h-7 w-7 items-center justify-center rounded-full border bg-card",
                isError ? "border-destructive/50 text-destructive" : "border-primary/30 text-primary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="font-medium leading-tight">{event.title}</p>
              {event.description && (
                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{formatRelative(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
