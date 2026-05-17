import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getTicketById } from "@dior/backend";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { replyTicketAction } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { FastLink } from "@/components/ui/fast-link";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  let ticket;
  try {
    ticket = await getTicketById(id, session.user.id);
  } catch {
    notFound();
  }

  const reply = replyTicketAction.bind(null, id);

  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={`Ticket #${ticket.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: "Support", href: "/support" },
          { label: ticket.subject },
        ]}
        actions={<Badge variant="muted">{ticket.status}</Badge>}
      />
      <PageContainer className="max-w-3xl space-y-6">
        <Panel title="Conversation" noPadding>
          <div className="divide-y divide-white/6">
            {ticket.messages.map((msg) => (
              <div key={msg.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{msg.author.email ?? msg.author.id.slice(0, 8)}</span>
                  <span>{formatRelative(msg.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{msg.body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Reply">
          <form action={reply} className="space-y-4">
            <textarea
              name="body"
              required
              rows={4}
              placeholder="Your message…"
              className="flex w-full rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-sm focus-glow"
            />
            <div className="flex gap-2">
              <Button type="submit">Send reply</Button>
              <Button type="button" variant="outline" asChild>
                <FastLink href="/support">Back to tickets</FastLink>
              </Button>
            </div>
          </form>
        </Panel>
      </PageContainer>
    </>
  );
}
