import { Header } from "@/components/layout/header";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { requireSession } from "@/lib/auth";
import { getServerT } from "@/lib/i18n/server";
import { getUserNotifications } from "@dior/backend";

export default async function NotificationsPage() {
  const session = await requireSession();
  const t = await getServerT();
  const { items } = await getUserNotifications(session.user.id, false, 1, 50);

  return (
    <>
      <Header
        title={t("page.notifications.title")}
        description={t("page.notifications.description")}
        user={session.user}
      />
      <NotificationsList items={items} />
    </>
  );
}
