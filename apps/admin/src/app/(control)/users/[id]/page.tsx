import Link from "next/link";
import { getAdminUserDetail } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "@/components/control/user-actions";
import { UserBalanceForm } from "@/components/control/user-balance-form";
import { requireControlSession } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireControlSession();

  let data;
  try {
    data = await getAdminUserDetail(actor.id, id);
  } catch {
    notFound();
  }

  const { user } = data;

  return (
    <>
      <PageHeader
        title={user.email ?? "User"}
        description={user.id}
        actions={<UserActions userId={user.id} status={user.status} role={user.role} />}
      />
      <PageContainer>
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

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Balance adjustment">
            <UserBalanceForm userId={user.id} currentBalance={user.balance} />
          </Panel>
          <Panel title="Profile">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Email</dt><dd>{user.email ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Telegram</dt><dd>{user.telegramUsername ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Role</dt><dd><Badge>{user.role}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted-foreground)]">Created</dt><dd>{formatDate(user.createdAt)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Services">
            <ul className="space-y-2 text-sm">
              {data.services.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <Link href={`/services?q=${s.id}`} className="hover:text-primary">{s.label}</Link>
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
                {formatDate(a.createdAt)} — {a.action} {a.actorEmail ? `by ${a.actorEmail}` : ""}
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
