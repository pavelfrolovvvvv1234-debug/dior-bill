"use client";

import { formatLocalDateTime, type DateTimeMode } from "@/lib/datetime";
import { useI18n } from "@/lib/i18n/store";

export function LocalDateTime({
  value,
  mode = "datetime",
  className,
  title,
}: {
  value: Date | string | null | undefined;
  mode?: DateTimeMode;
  className?: string;
  /** ISO timestamp on hover; pass false to hide */
  title?: boolean;
}) {
  const locale = useI18n((s) => s.locale);

  if (value == null) return <>—</>;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return <>—</>;

  const formatted = formatLocalDateTime(d, { locale, mode });
  const iso = d.toISOString();

  return (
    <time
      dateTime={iso}
      className={className}
      title={title !== false ? iso : undefined}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
