import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "default" | "outline" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  default: "bg-primary text-white hover:bg-primary/90",
  outline: "border border-white/10 bg-transparent hover:bg-white/5",
  ghost: "hover:bg-white/5",
  destructive: "bg-destructive/20 text-destructive hover:bg-destructive/30",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ className, variant = "default", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
