import Link from "next/link";
import { listAdminServices } from "@dior/backend";
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
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { ServiceRowDelete } from "@/components/control/service-row-delete";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminServices(actor.id, {
    q: params.q,
    type: params.type as import("@dior/database").ServiceType | undefined,
    status: params.status as import("@dior/database").ServiceStatus | undefined,
    page: Number(params.page ?? 1),
  });

  return (
    <>
      <PageHeader title="Services" description="VPS, dedicated, domains, CDN — unified control" />
      <PageContainer>
        <Panel title="All services" description={`${data.total} total`} noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Service</DataTableTh>
              <DataTableTh>Type</DataTableTh>
              <DataTableTh>Customer</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">MRR</DataTableTh>
              <DataTableTh align="right"> </DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No services" colSpan={6} />
              ) : (
                data.items.map((s) => (
                  <DataTableClickableRow key={s.id} href={controlPath(`/services/${s.id}`)}>
                    <DataTableTd>
                      <p className="font-medium">{s.label}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {s.vpsInstance?.primaryIp ?? s.dedicatedServer?.primaryIp ?? s.domain?.domainName ?? s.cdnZone?.zoneName ?? s.id.slice(0, 8)}
                      </p>
                    </DataTableTd>
                    <DataTableTd>{s.type}</DataTableTd>
                    <DataTableTd>
                      <Link href={controlPath(`/users/${s.user.id}`)} className="hover:text-primary">
                        {s.user.email}
                      </Link>
                    </DataTableTd>
                    <DataTableTd><Badge>{s.status}</Badge></DataTableTd>
                    <DataTableTd align="right" mono>{formatMoney(Number(s.monthlyPrice))}</DataTableTd>
                    <DataTableTd align="right">
                      <div className="flex items-center justify-end gap-1">
                        <ServiceRowDelete serviceId={s.id} label={s.label} />
                        <Link
                          href={controlPath(`/services/${s.id}`)}
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
        </Panel>
      </PageContainer>
    </>
  );
}
