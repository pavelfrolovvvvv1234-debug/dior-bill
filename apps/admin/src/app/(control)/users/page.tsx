import Link from "next/link";
import { listAdminUsers } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requireControlSession } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/utils";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const data = await listAdminUsers(actor.id, { q: params.q, page });

  return (
    <>
      <PageHeader title="Users" description="Full user lifecycle control" />
      <PageContainer>
        <form className="max-w-md">
          <Input name="q" placeholder="Search email, telegram, referral code…" defaultValue={params.q} />
        </form>
        <Panel title="All users" description={`${data.total} total`} noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>User</DataTableTh>
              <DataTableTh>Role</DataTableTh>
              <DataTableTh>Balance</DataTableTh>
              <DataTableTh>Services</DataTableTh>
              <DataTableTh>Spent</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Last online</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No users found" colSpan={7} />
              ) : (
                data.items.map((u) => (
                  <DataTableRow key={u.id}>
                    <DataTableTd>
                      <Link href={`/users/${u.id}`} className="font-medium hover:text-primary">
                        {u.email ?? u.telegramUsername ?? u.id.slice(0, 10)}
                      </Link>
                    </DataTableTd>
                    <DataTableTd>{u.role}</DataTableTd>
                    <DataTableTd mono>{formatMoney(Number(u.balance))}</DataTableTd>
                    <DataTableTd>{u.activeServices}</DataTableTd>
                    <DataTableTd mono>{formatMoney(u.totalSpent)}</DataTableTd>
                    <DataTableTd>
                      <Badge variant={u.status === "ACTIVE" ? "success" : "warning"}>{u.status}</Badge>
                    </DataTableTd>
                    <DataTableTd className="text-[var(--muted-foreground)]">
                      {u.lastOnlineAt
                        ? formatDate(u.lastOnlineAt)
                        : u.lastLoginAt
                          ? formatDate(u.lastLoginAt)
                          : "—"}
                    </DataTableTd>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </Panel>
      </PageContainer>
    </>
  );
}
