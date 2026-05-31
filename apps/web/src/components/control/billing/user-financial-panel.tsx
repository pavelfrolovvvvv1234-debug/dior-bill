"use client";

import Link from "next/link";
import { controlPath } from "@/lib/control-paths";
import { formatDate, formatMoney } from "@/lib/utils";
import { BillingStatusBadge } from "./status-badge";
import { Panel } from "@/components/control/panel";

type Financials = Awaited<
  ReturnType<typeof import("@dior/backend").getAdminUserFinancials>
>;

export function UserFinancialPanel({ data, userId }: { data: Financials; userId: string }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Available" value={formatMoney(data.wallet.available)} />
        <Stat label="Locked" value={formatMoney(data.wallet.balanceLocked)} />
        <Stat label="Credits" value={formatMoney(data.wallet.credits)} />
        <Stat
          label="Referral %"
          value={data.wallet.customReferralPercent != null ? `${data.wallet.customReferralPercent}%` : "Default"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MiniTable
          title="Recent invoices"
          href={controlPath("/billing/invoices")}
          empty="No invoices"
          rows={data.invoices.map((i) => ({
            id: i.id,
            href: controlPath(`/billing/invoices/${i.id}`),
            primary: i.number,
            secondary: formatMoney(i.total),
            badge: i.status,
          }))}
        />
        <MiniTable
          title="Recent top-ups"
          href={controlPath("/billing/top-ups")}
          empty="No top-ups"
          rows={data.topUps.map((t) => ({
            id: t.id,
            href: controlPath(`/billing/top-ups/${t.id}`),
            primary: t.referenceCode,
            secondary: formatMoney(t.amount),
            badge: t.status,
          }))}
        />
        <MiniTable
          title="Ledger"
          href={controlPath("/billing/transactions")}
          empty="No transactions"
          rows={data.transactions.map((t) => ({
            id: t.id,
            href: controlPath(`/billing/transactions?q=${userId}`),
            primary: t.type,
            secondary: formatMoney(t.amount),
            badge: formatDate(t.createdAt),
          }))}
        />
        <MiniTable
          title="Promo redemptions"
          href={controlPath("/promo")}
          empty="No redemptions"
          rows={data.promoRedemptions.map((r) => ({
            id: r.id,
            href: controlPath("/promo"),
            primary: r.code,
            secondary: formatMoney(r.credit),
            badge: r.discountType,
          }))}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniTable({
  title,
  href,
  empty,
  rows,
}: {
  title: string;
  href: string;
  empty: string;
  rows: Array<{ id: string; href: string; primary: string; secondary: string; badge: string }>;
}) {
  return (
    <Panel
      title={title}
      action={
        <Link href={href} className="text-xs text-primary hover:underline">
          View all
        </Link>
      }
    >
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-[var(--muted-foreground)]">{empty}</li>}
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3">
            <Link href={row.href} className="min-w-0 truncate hover:text-primary">
              {row.primary}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs tabular-nums">{row.secondary}</span>
              <BillingStatusBadge status={row.badge} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
