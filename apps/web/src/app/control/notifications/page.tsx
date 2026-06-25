import { listBroadcasts } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { BroadcastForm } from "@/components/control/broadcast-form";
import { requireControlSession } from "@/lib/auth";
import { LocalDateTime } from "@/components/ui/local-datetime";

export default async function NotificationsPage() {
  const actor = await requireControlSession();
  const data = await listBroadcasts(actor.id);

  return (
    <>
      <PageHeader title="Notifications" description="Broadcasts and platform announcements" />
      <PageContainer>
        <BroadcastForm />
        <Panel title="Broadcast history">
          <ul className="space-y-3 text-sm">
            {data.items.map((b) => (
              <li key={b.id} className="border-b border-white/6 pb-3">
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {b.type} · {b.sentAt ? <>Sent <LocalDateTime value={b.sentAt} /></> : "Draft"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
