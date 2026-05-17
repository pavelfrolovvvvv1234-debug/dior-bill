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
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

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
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No services" colSpan={5} />
              ) : (
                data.items.map((s) => (
                  <DataTableRow key={s.id}>
                    <DataTableTd>
                      <p className="font-medium">{s.label}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {s.vpsInstance?.primaryIp ?? s.dedicatedServer?.primaryIp ?? s.domain?.domainName ?? s.cdnZone?.zoneName ?? s.id.slice(0, 8)}
                      </p>
                    </DataTableTd>
                    <DataTableTd>{s.type}</DataTableTd>
                    <DataTableTd>{s.user.email}</DataTableTd>
                    <DataTableTd><Badge>{s.status}</Badge></DataTableTd>
                    <DataTableTd align="right" mono>{formatMoney(Number(s.monthlyPrice))}</DataTableTd>
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
