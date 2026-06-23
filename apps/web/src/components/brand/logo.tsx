import { cn } from "@/lib/utils";

export type LogoVariant = "mark" | "icon";

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  priority?: boolean;
}

const BRAND_ORIGIN = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://dior.host").replace(
  /\/$/,
  "",
);

/** Remote brand icon — works on local dev without generated public assets */
const srcByVariant: Record<LogoVariant, string> = {
  mark: `${BRAND_ORIGIN}/favicon.ico`,
  icon: `${BRAND_ORIGIN}/favicon.ico`,
};

export function Logo({ variant = "mark", size = 32, className, priority }: LogoProps) {
  const src = srcByVariant[variant];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="DiorHost"
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      draggable={false}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size, maxWidth: "100%", maxHeight: "100%" }}
    />
  );
}

interface LogoWordmarkProps {
  collapsed?: boolean;
  className?: string;
}

/** Sidebar wordmark: brand mark + DiorHost Control */
export function LogoWordmark({ collapsed = false, className }: LogoWordmarkProps) {
  if (collapsed) {
    return <Logo variant="icon" size={32} className={className} priority />;
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo variant="icon" size={32} className="rounded-md" priority />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight text-foreground">DiorHost</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Control
        </span>
      </span>
    </div>
  );
}
