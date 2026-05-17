import { Header } from "@/components/layout/header";
import { requireSession } from "@/lib/auth";
import { getUserNotifications } from "@dior/backend";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await requireSession();
  const { items } = await getUserNotifications(session.user.id, false, 1, 50);

  return (
    <>
      <Header title="Notifications" description="Alerts & updates" user={session.user} />
      <div className="max-w-2xl space-y-3 p-6">
        {items.map((n) => (
          <Card key={n.id} className={`glass ${!n.read ? "border-primary/30" : ""}`}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
