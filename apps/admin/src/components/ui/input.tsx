import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
          className,
        )}
        {...props}
      />
    );
  },
);
