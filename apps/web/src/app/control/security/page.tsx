import { getSecurityFeed } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { ReviewActions } from "@/components/control/review-actions";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { LocalDateTime } from "@/components/ui/local-datetime";

export default async function SecurityPage() {
  const actor = await requireControlSession();
  const feed = await getSecurityFeed(actor.id);

  return (
    <>
      <PageHeader title="Security & abuse" description="Fraud detection, manual review, abuse reports" />
      <PageContainer>
        <Panel title="Manual review queue">
          <ul className="space-y-3 text-sm">
            {feed.reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 pb-3">
                <div>
                  <p className="font-medium">{r.user.email}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{r.reason}</p>
                </div>
                <Badge>risk {r.riskScore}</Badge>
                <ReviewActions reviewId={r.id} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Failed payments">
          <ul className="space-y-2 text-sm">
            {feed.failedTopUps.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.user.email}</span>
                <span className="text-[var(--muted-foreground)]">{t.provider} · <LocalDateTime value={t.createdAt} /></span>
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
