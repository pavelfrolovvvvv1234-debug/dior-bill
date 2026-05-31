"use client";

import { CheckCircle2, Circle, AlertCircle, Rocket, RefreshCw, Pause, type LucideIcon } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { TimelineEmpty } from "@/components/ui/timeline";

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  severity: string;
  createdAt: Date;
}

const iconForType: Record<string, LucideIcon> = {
  ordered: Rocket,
  deployed: CheckCircle2,
  renewed: RefreshCw,
  upgraded: RefreshCw,
  suspended: Pause,
  provision_failed: AlertCircle,
};

export function ServiceTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return <TimelineEmpty message="No events yet." />;
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const Icon = iconForType[event.type] ?? Circle;
        const isError = event.severity === "error";
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex w-7 shrink-0 flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card ${
                  isError ? "border-destructive/50 text-destructive" : "border-primary/30 text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="mt-0.5 w-px flex-1 min-h-6 bg-border" aria-hidden />}
            </div>
            <div className={`min-w-0 flex-1 ${!isLast ? "pb-6" : ""}`}>
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
