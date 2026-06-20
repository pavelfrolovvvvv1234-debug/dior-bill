import { hasProcessed, withIdempotency } from "../core/events/idempotency";
import { notifyAdminsOperationalAlert } from "../telegram/admin-notify";

export type OperationalAlertSeverity = "warning" | "error" | "critical";

const ALERT_TTL_MS = 24 * 60 * 60 * 1000;

export async function reportOperationalIssue(params: {
  category: string;
  message: string;
  severity?: OperationalAlertSeverity;
  details?: Record<string, string | number | undefined>;
  serviceId?: string;
  userId?: string;
  /** Dedupe key — same key alerts at most once per 24h */
  dedupeKey?: string;
  notifyTelegram?: boolean;
}): Promise<void> {
  const severity = params.severity ?? "error";
  const logLine = `[${params.category}] ${params.message}`;
  const detailSuffix = params.details ? ` ${JSON.stringify(params.details)}` : "";

  if (severity === "warning") {
    console.warn(logLine + detailSuffix);
  } else {
    console.error(logLine + detailSuffix);
  }

  if (params.notifyTelegram === false) return;
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;

  const dedupeKey = params.dedupeKey ?? `${params.category}:${params.message}:${params.serviceId ?? ""}`;
  if (await hasProcessed("ops_alert", dedupeKey)) return;

  await withIdempotency(
    "ops_alert",
    dedupeKey,
    async () => {
      await notifyAdminsOperationalAlert({
        category: params.category,
        message: params.message,
        severity,
        details: params.details,
        serviceId: params.serviceId,
        userId: params.userId,
      });
      return { sent: true };
    },
    ALERT_TTL_MS,
  ).catch((err) => console.warn("[operational-alert] telegram:", err));
}
