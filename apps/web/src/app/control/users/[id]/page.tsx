import Link from "next/link";
import { NotFoundError } from "@dior/shared";
import { getAdminUserDetail, getAdminUserFinancials } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "@/components/control/user-actions";
import { UserBalanceForm } from "@/components/control/user-balance-form";
import { CreateInvoiceForm } from "@/components/control/billing/create-invoice-form";
import { ReferralPercentForm } from "@/components/control/billing/referral-percent-form";
import { UserFinancialPanel } from "@/components/control/billing/user-financial-panel";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { LocalLastOnline } from "@/components/ui/local-last-online";
import { notFound } from "next/navigation";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireControlSession();

  let data;
  let financials;
  try {
    [data, financials] = await Promise.all([
      getAdminUserDetail(actor.id, id),
      getAdminUserFinancials(actor.id, id),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const { user } = data;

  return (
    <>
      <PageHeader
        title={user.email ?? "User"}
        description={user.id}
        actions={<UserActions userId={user.id} status={user.status} role={user.role} email={user.email} />}
      />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Balance", value: formatMoney(user.balance) },
            { label: "Total spent", value: formatMoney(data.totalSpent) },
            { label: "Referral earnings", value: formatMoney(data.referralEarnings) },
            { label: "Services", value: String(user.serviceCount) },
          ].map((k) => (
            <div key={k.label} className="panel p-4">
              <p className="text-xs text-[var(--muted-foreground)]">{k.label}</p>
              <p className="mt-1 text-xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>

        <Panel title="Financial overview" description="Billing activity across invoices, top-ups, and ledger">
          <UserFinancialPanel data={financials} userId={user.id} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Balance adjustment">
            <UserBalanceForm
              userId={user.id}
              currentBalance={financials.wallet.balance}
              balanceLocked={financials.wallet.balanceLocked}
            />
          </Panel>
          <Panel title="Create invoice">
            <CreateInvoiceForm userId={user.id} />
          </Panel>
          <Panel title="Referral program">
            <ReferralPercentForm userId={user.id} currentPercent={financials.wallet.customReferralPercent} />
          </Panel>
          <Panel title="Profile">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Email</dt><dd>{user.email ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Telegram</dt><dd>{user.telegramUsername ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Role</dt><dd><Badge variant="outline">{user.role.replace(/_/g, " ")}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Created</dt><dd><LocalDateTime value={user.createdAt} /></dd></div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Last online</dt>
                <dd>
                  <LocalLastOnline lastOnlineAt={user.lastOnlineAt} lastLoginAt={user.lastLoginAt} />
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Services">
            <ul className="space-y-2 text-sm">
              {data.services.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <Link href={controlPath(`/services/${s.id}`)} className="hover:text-primary">{s.label}</Link>
                  <Badge>{s.status}</Badge>
                </li>
              ))}
              {data.services.length === 0 && <p className="text-[var(--muted-foreground)]">No services</p>}
            </ul>
          </Panel>
        </div>

        <Panel title="Audit trail">
          <ul className="space-y-2 text-xs text-[var(--muted-foreground)]">
            {data.recentAudit.map((a) => (
              <li key={a.id}>
                <LocalDateTime value={a.createdAt} /> — {a.action} {a.actorEmail ? `by ${a.actorEmail}` : ""}
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
