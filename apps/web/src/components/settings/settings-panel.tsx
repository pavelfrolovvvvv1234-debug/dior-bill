import { cn } from "@/lib/utils";

export function SettingsPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/6 bg-white/[0.02] p-6 transition-premium",
        className,
      )}
    >
      <div className="mb-5 border-b border-white/6 pb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
