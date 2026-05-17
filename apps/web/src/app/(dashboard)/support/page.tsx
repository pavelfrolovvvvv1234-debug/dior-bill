import { requireSession } from "@/lib/auth";
import { getUserTickets } from "@dior/backend";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FastLink } from "@/components/ui/fast-link";
import { Plus } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export default async function SupportPage() {
  const session = await requireSession();
  const tickets = await getUserTickets(session.user.id);

  return (
    <>
      <PageHeader
        title="Support"
        description="Technical tickets — create, track, and reply"
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Support" }]}
        actions={
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/support/new">
              <Plus className="h-3.5 w-3.5" />
              New ticket
            </FastLink>
          </Button>
        }
      />
      <PageContainer>
        <Panel title="Your tickets" description={`${tickets.length} total`} noPadding>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No tickets yet</p>
              <Button className="mt-4 h-9" asChild>
                <FastLink href="/support/new">Open a ticket</FastLink>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-white/6">
              {tickets.map((t) => (
                <li key={t.id}>
                  <FastLink
                    href={`/support/${t.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-premium hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t._count.messages} message{t._count.messages === 1 ? "" : "s"} ·{" "}
                        {formatRelative(t.updatedAt)}
                      </p>
                    </div>
                    <Badge variant="muted">{t.status}</Badge>
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
