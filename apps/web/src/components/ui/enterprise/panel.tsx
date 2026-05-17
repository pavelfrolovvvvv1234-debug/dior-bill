import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Panel({ title, description, action, children, className, noPadding }: PanelProps) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {(title || action) && (
        <header className="panel-header">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(!noPadding && "panel-body")}>{children}</div>
    </section>
  );
}
