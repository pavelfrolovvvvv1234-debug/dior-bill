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
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { DataTableClickableRow } from "@/components/control/data-table-clickable-row";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { LocalLastOnline } from "@/components/ui/local-last-online";
import { UserRowDelete } from "@/components/control/user-row-delete";
import { ControlTablePagination } from "@/components/control/control-table-pagination";

const USERS_PAGE_SIZE = 100;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const data = await listAdminUsers(actor.id, {
    q: params.q,
    page,
    pageSize: USERS_PAGE_SIZE,
  });

  return (
    <>
      <PageHeader title="Users" description="Full user lifecycle control" />
      <PageContainer>
        <form method="get" className="max-w-md">
          <Input name="q" placeholder="Search email, telegram, referral code…" defaultValue={params.q} />
        </form>
        <Panel
          title="All users"
          description={`${data.items.length} shown · ${data.total} total`}
          noPadding
        >
          <DataTable>
            <DataTableHead>
              <DataTableTh>User</DataTableTh>
              <DataTableTh>Role</DataTableTh>
              <DataTableTh>Balance</DataTableTh>
              <DataTableTh>Services</DataTableTh>
              <DataTableTh>Spent</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Last online</DataTableTh>
              <DataTableTh align="right"> </DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No users found" colSpan={8} />
              ) : (
                data.items.map((u) => (
                  <DataTableClickableRow key={u.id} href={controlPath(`/users/${u.id}`)}>
                    <DataTableTd>
                      <p className="font-medium">
                        {u.email ?? u.telegramUsername ?? u.id.slice(0, 10)}
                      </p>
                    </DataTableTd>
                    <DataTableTd>{u.role}</DataTableTd>
                    <DataTableTd mono>{formatMoney(Number(u.balance))}</DataTableTd>
                    <DataTableTd>{u.activeServices}</DataTableTd>
                    <DataTableTd mono>{formatMoney(u.totalSpent)}</DataTableTd>
                    <DataTableTd>
                      <Badge variant={u.status === "ACTIVE" ? "success" : "warning"}>{u.status}</Badge>
                    </DataTableTd>
                    <DataTableTd className="text-muted-foreground">
                      <LocalLastOnline lastOnlineAt={u.lastOnlineAt} lastLoginAt={u.lastLoginAt} />
                    </DataTableTd>
                    <DataTableTd align="right">
                      <div className="flex items-center justify-end gap-1">
                        <UserRowDelete userId={u.id} email={u.email} />
                        <Link
                          href={controlPath(`/users/${u.id}`)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Manage
                        </Link>
                      </div>
                    </DataTableTd>
                  </DataTableClickableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
          <ControlTablePagination
            page={data.page}
            totalPages={data.totalPages}
            basePath={controlPath("/users")}
            params={{ q: params.q }}
          />
        </Panel>
      </PageContainer>
    </>
  );
}
