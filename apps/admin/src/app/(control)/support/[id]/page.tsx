import { getAdminTicket } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { TicketActions } from "@/components/control/ticket-actions";
import { requireControlSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireControlSession();

  let ticket;
  try {
    ticket = await getAdminTicket(actor.id, id);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={`${ticket.user.email} · ${ticket.status}`}
        actions={<TicketActions ticketId={ticket.id} status={ticket.status} />}
      />
      <PageContainer>
        <Panel title="Conversation">
          <ul className="space-y-4">
            {ticket.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-lg border p-4 text-sm ${m.internal ? "border-amber-500/30 bg-amber-500/5" : "border-white/6"}`}
              >
                <p className="text-xs text-[var(--muted-foreground)]">
                  {m.author.email} · {formatDate(m.createdAt)}
                  {m.internal && " · internal"}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
