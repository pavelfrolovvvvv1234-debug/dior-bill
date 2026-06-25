"use client";

import { formatLocalDateTime } from "@/lib/datetime";
import { formatRelative } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/store";

const RECENT_ONLINE_MS = 7 * 24 * 60 * 60 * 1000;

function resolveLastOnlineAt(
  lastOnlineAt?: Date | string | null,
  lastLoginAt?: Date | string | null,
): Date | null {
  if (lastOnlineAt) return new Date(lastOnlineAt);
  if (lastLoginAt) return new Date(lastLoginAt);
  return null;
}

export function LocalLastOnline({
  lastOnlineAt,
  lastLoginAt,
  className,
}: {
  lastOnlineAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  className?: string;
}) {
  const locale = useI18n((s) => s.locale);
  const at = resolveLastOnlineAt(lastOnlineAt, lastLoginAt);

  if (!at || Number.isNaN(at.getTime())) {
    return <span className={className}>—</span>;
  }

  const formatted =
    Date.now() - at.getTime() <= RECENT_ONLINE_MS
      ? formatRelative(at)
      : formatLocalDateTime(at, { locale, mode: "datetime" });

  return (
    <time
      dateTime={at.toISOString()}
      className={className}
      title={formatLocalDateTime(at, { locale, mode: "datetime" })}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
