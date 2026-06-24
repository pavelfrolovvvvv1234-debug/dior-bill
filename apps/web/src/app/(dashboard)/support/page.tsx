import { requireSession } from "@/lib/auth";
import { getUserTickets } from "@dior/backend";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Panel } from "@/components/ui/enterprise/panel";
import { TicketPriorityBadge } from "@/components/support/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { FastLink } from "@/components/ui/fast-link";
import { Plus } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { getServerT } from "@/lib/i18n/server";

export default async function SupportPage() {
  const session = await requireSession();
  const [tickets, t] = await Promise.all([getUserTickets(session.user.id), getServerT()]);

  return (
    <>
      <I18nPageHeader
        titleKey="pages.support.title"
        descriptionKey="pages.support.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.overview", href: "/dashboard" },
          { labelKey: "nav.support" },
        ]}
        actions={
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/support/new">
              <Plus className="h-3.5 w-3.5" />
              {t("support.newTicket")}
            </FastLink>
          </Button>
        }
      />
      <PageContainer>
        <Panel
          title={t("support.yourTickets")}
          description={t("support.ticketsTotal", { count: tickets.length })}
          noPadding
        >
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm text-muted-foreground">{t("support.empty")}</p>
              <Button className="mt-4 h-9" asChild>
                <FastLink href="/support/new">{t("support.openTicket")}</FastLink>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-white/6">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <FastLink
                    href={`/support/${ticket.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-premium hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("support.messageCount", { count: ticket._count.messages })} ·{" "}
                        {formatRelative(ticket.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TicketPriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                  </FastLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageContainer>
    </>
  );
}
