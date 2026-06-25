"use client";

import { Timeline, TimelineEmpty } from "@/components/ui/timeline";
import { LocalDateTime } from "@/components/ui/local-datetime";

export function EventTimeline({
  events,
}: {
  events: Array<{ id: string; event: string; createdAt: string; payload?: unknown }>;
}) {
  if (events.length === 0) {
    return <TimelineEmpty message="No events recorded" />;
  }

  return (
    <Timeline
      lineClassName="bg-white/10"
      markerClassName="ring-background"
      items={events.map((event) => ({
        id: event.id,
        title: event.event,
        meta: <LocalDateTime value={event.createdAt} />,
      }))}
    />
  );
}
