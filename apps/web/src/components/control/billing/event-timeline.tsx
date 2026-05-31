export function EventTimeline({
  events,
}: {
  events: Array<{ id: string; event: string; createdAt: string; payload?: unknown }>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No events recorded</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-white/10 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-primary/80 ring-4 ring-[#09090b]" />
          <p className="text-sm font-medium">{event.event}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {new Date(event.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
