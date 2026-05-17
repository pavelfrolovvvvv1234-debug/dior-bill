import { requireSession } from "@/lib/auth";
import { getUserActivityFeed, getInfrastructureFeed } from "@dior/backend";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Panel } from "@/components/ui/enterprise/panel";
import { SeverityTag } from "@/components/ui/enterprise/severity-tag";
import { formatRelative } from "@/lib/utils";

export default async function AbusePage() {
  const session = await requireSession();

  const [activity, feed] = await Promise.all([
    getUserActivityFeed(session.user.id, 20),
    getInfrastructureFeed(1, 10),
  ]);

  const incidents = feed.items.filter(
    (f) =>
      f.type.toLowerCase().includes("abuse") ||
      f.type.toLowerCase().includes("security") ||
      f.severity === "warning",
  );

  return (
    <>
      <PageHeader
        title="Abuse Monitor"
        description="Incident feed, flagged resources, and account audit timeline"
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Abuse Monitor" }]}
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-12">
          <Panel
            title="Incident feed"
            description="Platform and account-level events"
            className="lg:col-span-7"
          >
            <div className="space-y-3">
              {incidents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No open abuse incidents on your account.
                </p>
              ) : (
                incidents.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-md border border-white/6 bg-white/[0.02] p-4 transition-premium hover:border-white/10 hover:bg-white/[0.04] edge-glow-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <SeverityTag severity={item.severity} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {item.type} · {formatRelative(item.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </Panel>

          <Panel
            title="Audit log"
            description="Immutable activity timeline"
            className="lg:col-span-5"
          >
            <ol className="relative border-l border-white/10 pl-4">
              {activity.slice(0, 12).map((entry) => (
                <li key={entry.id} className="mb-5 last:mb-0">
                  <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <p className="text-sm font-medium leading-snug">{entry.title}</p>
                  {entry.subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.subtitle}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatRelative(entry.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <Panel title="Policy" description="DIOR.host abuse handling" className="mt-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Complaints are reviewed manually before any suspension. DMCA and abuse tickets open a
            mediation workflow — not instant shutdown. Zero-tolerance applies only to malware, child
            abuse, and terrorism. All decisions are logged in your audit trail.
          </p>
        </Panel>
      </PageContainer>
    </>
  );
}

