import { formatDate, formatRelative } from "@/lib/utils";

const RECENT_ONLINE_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveLastOnlineAt(
  lastOnlineAt?: Date | string | null,
  lastLoginAt?: Date | string | null,
): Date | null {
  if (lastOnlineAt) return new Date(lastOnlineAt);
  if (lastLoginAt) return new Date(lastLoginAt);
  return null;
}

export function formatLastOnline(
  lastOnlineAt?: Date | string | null,
  lastLoginAt?: Date | string | null,
): string {
  const at = resolveLastOnlineAt(lastOnlineAt, lastLoginAt);
  if (!at || Number.isNaN(at.getTime())) return "—";

  if (Date.now() - at.getTime() <= RECENT_ONLINE_MS) {
    return formatRelative(at);
  }

  return formatDate(at);
}

export function formatLastOnlineTitle(
  lastOnlineAt?: Date | string | null,
  lastLoginAt?: Date | string | null,
): string | undefined {
  const at = resolveLastOnlineAt(lastOnlineAt, lastLoginAt);
  if (!at || Number.isNaN(at.getTime())) return undefined;
  return formatDate(at);
}
