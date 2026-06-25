import Link from "next/link";
import { getPromoCodeDetail } from "@dior/backend";
import { formatPromoValue } from "@dior/shared";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { PromoRowActions } from "@/components/control/billing/promo-row-actions";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { notFound } from "next/navigation";

export default async function PromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireControlSession();

  let promo;
  try {
    promo = await getPromoCodeDetail(actor.id, id);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={promo.code}
        description={`${promo.discountType} · ${formatPromoValue(promo.discountType, promo.discountValue)}`}
        actions={<PromoRowActions id={promo.id} active={promo.active} />}
      />
      <PageContainer>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Uses" value={`${promo.usedCount}${promo.maxUses ? ` / ${promo.maxUses}` : ""}`} />
          <Stat label="Status" value={<BillingStatusBadge status={promo.active ? "ACTIVE" : "CANCELLED"} />} />
          <Stat label="Valid until" value={promo.validUntil ? <LocalDateTime value={promo.validUntil} mode="date" /> : "No expiry"} />
          <Stat label="Created" value={<LocalDateTime value={promo.createdAt} />} />
        </div>
        <Panel title="Redemption history">
          <ul className="space-y-2 text-sm">
            {promo.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <Link href={controlPath(`/users/${r.user.id}`)} className="hover:text-primary">
                  {r.user.email ?? r.user.id.slice(0, 8)}
                </Link>
                <span className="font-mono tabular-nums">{formatMoney(r.credit)}</span>
                <span className="text-xs text-[var(--muted-foreground)]"><LocalDateTime value={r.createdAt} /></span>
              </li>
            ))}
            {promo.redemptions.length === 0 && (
              <p className="text-[var(--muted-foreground)]">No redemptions yet</p>
            )}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
