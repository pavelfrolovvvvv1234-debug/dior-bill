import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-premium",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
        warning: "border-amber-500/25 bg-amber-500/10 text-amber-400",
        destructive: "border-red-500/25 bg-red-500/10 text-red-400",
        outline: "border-white/10 bg-transparent text-foreground",
        muted: "border-white/6 bg-white/[0.03] text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
