import { Timeline, TimelineEmpty } from "@/components/ui/timeline";

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
      markerClassName="ring-[#09090b]"
      items={events.map((event) => ({
        id: event.id,
        title: event.event,
        meta: new Date(event.createdAt).toLocaleString(),
      }))}
    />
  );
}
