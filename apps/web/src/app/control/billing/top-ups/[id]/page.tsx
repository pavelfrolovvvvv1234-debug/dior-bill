import Link from "next/link";
import { getAdminTopUpDetail } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { Panel } from "@/components/control/panel";
import { TopUpActions } from "@/components/control/billing/topup-actions";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { EventTimeline } from "@/components/control/billing/event-timeline";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatDate, formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function TopUpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireControlSession();

  let topUp;
  try {
    topUp = await getAdminTopUpDetail(actor.id, id);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={topUp.referenceCode}
        description={`${topUp.provider} · ${topUp.user.email ?? topUp.user.id}`}
        actions={<TopUpActions topUpId={topUp.id} status={topUp.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Amount", value: formatMoney(topUp.amount) },
          { label: "Net credited", value: formatMoney(topUp.netAmount) },
          { label: "Fee", value: formatMoney(topUp.fee) },
          { label: "Status", value: topUp.status },
        ].map((k) => (
          <div key={k.label} className="panel p-4">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{k.label}</p>
            <p className="mt-1 text-lg font-semibold">
              {k.label === "Status" ? <BillingStatusBadge status={k.value} /> : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Payment details">
          <dl className="space-y-2 text-sm">
            <Row label="External ID" value={topUp.externalId ?? "—"} />
            <Row label="Created" value={formatDate(topUp.createdAt)} />
            <Row label="Paid at" value={topUp.paidAt ? formatDate(topUp.paidAt) : "—"} />
            <Row label="Expires" value={topUp.expiresAt ? formatDate(topUp.expiresAt) : "—"} />
            {topUp.failureReason && <Row label="Failure" value={topUp.failureReason} />}
            {topUp.adminNotes && <Row label="Admin notes" value={topUp.adminNotes} />}
            {topUp.paymentUrl && (
              <div className="pt-2">
                <a href={topUp.paymentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Open payment URL →
                </a>
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Customer">
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={topUp.user.email ?? "—"} />
            <Row label="Balance" value={formatMoney(topUp.user.balance)} />
            {topUp.reviewedBy && (
              <Row label="Reviewed by" value={topUp.reviewedBy.email ?? topUp.reviewedBy.displayName ?? "—"} />
            )}
          </dl>
          <Link href={controlPath(`/users/${topUp.user.id}`)} className="mt-4 inline-block text-xs text-primary">
            Open customer profile →
          </Link>
        </Panel>
      </div>

      <Panel title="Event timeline">
        <EventTimeline events={topUp.events} />
      </Panel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="max-w-[60%] text-right break-all">{value}</dd>
    </div>
  );
}
