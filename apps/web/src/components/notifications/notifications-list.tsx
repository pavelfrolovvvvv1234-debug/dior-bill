"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/store";
import {
  formatRelativeI18n,
  translateNotificationText,
} from "@/lib/i18n/translate-notification";

type Item = {
  id: string;
  type?: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date | string;
};

export function NotificationsList({ items }: { items: Item[] }) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <p className="px-6 text-sm text-muted-foreground">{t("notificationBell.empty")}</p>
    );
  }

  return (
    <div className="max-w-2xl space-y-3 p-6">
      {items.map((n) => {
        const text = translateNotificationText(n, t);
        return (
          <Card key={n.id} className={`glass ${!n.read ? "border-primary/30" : ""}`}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                {!n.read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
                <div>
                  <p className="font-medium">{text.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatRelativeI18n(n.createdAt, t)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
