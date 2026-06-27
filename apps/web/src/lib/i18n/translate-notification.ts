type TFn = (key: string, vars?: Record<string, string | number>) => string;

export type NotificationLike = {
  type?: string | null;
  title: string;
  body: string;
};

export function translateNotificationText(
  item: NotificationLike,
  t: TFn,
): { title: string; body: string } {
  const title = item.title.trim();
  const body = item.body.trim();

  if (title === "VPS deployed" || item.type === "deployment") {
    const m = body.match(/^(.+) is now active at (.+)$/);
    if (m) {
      return {
        title: t("notificationBell.messages.vpsDeployedTitle"),
        body: t("notificationBell.messages.vpsDeployedBody", { label: m[1], ip: m[2] }),
      };
    }
  }

  if (title === "Payment failed") {
    const reasonKey =
      body === "Marked failed by admin"
        ? t("notificationBell.messages.paymentFailedByAdmin")
        : body;
    return {
      title: t("notificationBell.messages.paymentFailedTitle"),
      body: t("notificationBell.messages.paymentFailedBody", { reason: reasonKey }),
    };
  }

  if (title === "Balance credited") {
    const m = body.match(/^\$(.+?) added to your wallet$/);
    if (m) {
      return {
        title: t("notificationBell.messages.balanceCreditedTitle"),
        body: t("notificationBell.messages.balanceCreditedBody", { amount: m[1] }),
      };
    }
  }

  if (title === "Payment invoice created") {
    const m = body.match(/^\$(.+?) — complete payment to credit your balance$/);
    if (m) {
      return {
        title: t("notificationBell.messages.invoiceCreatedTitle"),
        body: t("notificationBell.messages.invoiceCreatedBody", { amount: m[1] }),
      };
    }
  }

  if (title === "Manual transfer request created") {
    const m = body.match(/^Reference (.+?) — awaiting support confirmation$/);
    if (m) {
      return {
        title: t("notificationBell.messages.manualTransferTitle"),
        body: t("notificationBell.messages.manualTransferBody", { reference: m[1] }),
      };
    }
  }

  if (title === "Transfer request declined") {
    return {
      title: t("notificationBell.messages.transferDeclinedTitle"),
      body: t("notificationBell.messages.transferDeclinedBody", { reason: body }),
    };
  }

  if (title === "Invoice overdue") {
    return {
      title: t("notificationBell.messages.invoiceOverdueTitle"),
      body: t("notificationBell.messages.invoiceOverdueBody", { detail: body }),
    };
  }

  if (title === "Support ticket update" || title === "New support ticket") {
    return {
      title: t("notificationBell.messages.ticketUpdateTitle"),
      body: body,
    };
  }

  return { title, body };
}

export function formatRelativeI18n(
  date: Date | string,
  t: TFn,
): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) {
    return t("notificationBell.relativeMinutes", { count: mins });
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return t("notificationBell.relativeHours", { count: hours });
  }
  return t("notificationBell.relativeDays", { count: Math.floor(hours / 24) });
}
