export function Panel({
  title,
  description,
  action,
  children,
  noPadding,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className={noPadding ? undefined : "p-5"}>{children}</div>
    </section>
  );
}
