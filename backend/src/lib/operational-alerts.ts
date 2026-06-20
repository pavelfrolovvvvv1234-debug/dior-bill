import { hasProcessed, withIdempotency } from "../core/events/idempotency";
import {
  notifyAdminsBillingAlert,
  notifyAdminsProvisioningStuck,
  notifyAdminsQueueJobDead,
  notifyAdminsWorkerError,
} from "../telegram/admin-notify";

export type OperationalAlertSeverity = "warning" | "error" | "critical";

const ALERT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Logs billing/provisioning issues and sends Telegram admin alerts.
 * Uses the same TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_IDS as top-ups and tickets.
 */
export async function reportOperationalIssue(params: {
  category: string;
  message: string;
  severity?: OperationalAlertSeverity;
  details?: Record<string, string | number | undefined>;
  serviceId?: string;
  userId?: string;
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

  const dedupeKey = params.dedupeKey ?? `${params.category}:${params.message}:${params.serviceId ?? ""}`;
  if (await hasProcessed("ops_alert", dedupeKey)) return;

  await withIdempotency(
    "ops_alert",
    dedupeKey,
    async () => {
      switch (params.category) {
        case "provisioning.stuck":
          if (params.serviceId && params.userId) {
            await notifyAdminsProvisioningStuck({
              serviceId: params.serviceId,
              userId: params.userId,
              label: String(params.details?.label ?? "VPS"),
              message: params.message,
            });
          } else {
            await notifyAdminsBillingAlert({
              headline: "VPS provisioning stuck",
              message: params.message,
              severity,
              serviceId: params.serviceId,
              userId: params.userId,
              details: params.details,
            });
          }
          break;
        case "queue.dead":
          await notifyAdminsQueueJobDead({
            jobType: String(params.details?.jobType ?? params.details?.type ?? "unknown"),
            jobId: String(params.details?.jobId ?? ""),
            error: String(params.details?.error ?? params.message),
            serviceId: params.serviceId,
          });
          break;
        case "worker.loop":
          await notifyAdminsWorkerError({ message: params.message });
          break;
        default:
          await notifyAdminsBillingAlert({
            headline: params.category,
            message: params.message,
            severity,
            serviceId: params.serviceId,
            userId: params.userId,
            details: params.details,
          });
      }
      return { sent: true };
    },
    ALERT_TTL_MS,
  ).catch((err) => console.warn("[operational-alert] telegram:", err));
}
