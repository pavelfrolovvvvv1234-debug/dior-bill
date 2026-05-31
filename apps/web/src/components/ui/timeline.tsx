"use client";

import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
}

export function Timeline({
  items,
  className,
  markerClassName,
  lineClassName,
}: {
  items: TimelineItem[];
  className?: string;
  markerClassName?: string;
  lineClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex w-5 shrink-0 flex-col items-center">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background",
                    markerClassName,
                  )}
                  aria-hidden
                />
              </div>
              {!isLast && (
                <div
                  className={cn("mt-0.5 w-px flex-1 min-h-6 bg-border", lineClassName)}
                  aria-hidden
                />
              )}
            </div>
            <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.description && (
                <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
              )}
              {item.meta && (
                <div className="mt-1 text-xs text-muted-foreground">{item.meta}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TimelineEmpty({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}
