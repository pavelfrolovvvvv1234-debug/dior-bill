import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const styles = {
    default: "bg-white/10 text-foreground",
    success: "bg-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/15 text-amber-400",
    destructive: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-[11px] font-medium", styles[variant], className)}>
      {children}
    </span>
  );
}
