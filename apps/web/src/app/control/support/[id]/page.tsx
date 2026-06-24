import Link from "next/link";
import { getAdminTicket } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { TicketActions } from "@/components/control/ticket-actions";
import { TicketReplyForm } from "@/components/control/ticket-reply-form";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { ADMIN_ROLES } from "@dior/shared";
import { formatDate, formatMoney } from "@/lib/utils";
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
        actions={
          <TicketActions
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            subject={ticket.subject}
          />
        }
      />
      <PageContainer className="max-w-3xl space-y-6">
        <Panel title="Клиент">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Email</dt>
              <dd className="mt-0.5 font-medium">
                <Link
                  href={controlPath(`/users/${ticket.user.id}`)}
                  className="hover:text-primary"
                >
                  {ticket.user.email ?? "—"}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Баланс</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums">
                {formatMoney(ticket.customerStats.balance)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--muted-foreground)]">Всего пополнено на сайте</dt>
              <dd className="mt-0.5">
                <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                  {formatMoney(ticket.customerStats.totalTopUpGross)}
                </span>
                <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                  {ticket.customerStats.topUpCount}{" "}
                  {ticket.customerStats.topUpCount === 1
                    ? "пополнение"
                    : ticket.customerStats.topUpCount >= 2 && ticket.customerStats.topUpCount <= 4
                      ? "пополнения"
                      : "пополнений"}
                  {ticket.customerStats.totalTopUpNet !== ticket.customerStats.totalTopUpGross && (
                    <>
                      {" "}
                      · зачислено {formatMoney(ticket.customerStats.totalTopUpNet)}
                    </>
                  )}
                </span>
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Conversation">
          <ul className="space-y-4">
            {ticket.messages.map((m) => {
              const isStaff = ADMIN_ROLES.includes(
                m.author.role as (typeof ADMIN_ROLES)[number],
              );
              return (
                <li
                  key={m.id}
                  className={`rounded-lg border p-4 text-sm ${
                    m.internal
                      ? "border-amber-500/30 bg-amber-500/5"
                      : isStaff
                        ? "border-primary/20 bg-primary/5"
                        : "border-white/6 bg-white/[0.02]"
                  }`}
                >
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {isStaff ? "Support" : "Customer"} · {m.author.email ?? "—"} ·{" "}
                    {formatDate(m.createdAt)}
                    {m.internal && " · internal note"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
                </li>
              );
            })}
            {ticket.messages.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No messages yet.</p>
            )}
          </ul>
        </Panel>

        <Panel title="Reply to customer">
          <TicketReplyForm ticketId={ticket.id} />
        </Panel>
      </PageContainer>
    </>
  );
}

