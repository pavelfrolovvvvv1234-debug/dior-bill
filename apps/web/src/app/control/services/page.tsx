import Link from "next/link";
import { listAdminClusterVps, listAdminServices } from "@dior/backend";
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
import { AdminVpsSourceBadge } from "@/components/control/admin-vps-credentials";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { ServiceRowDelete } from "@/components/control/service-row-delete";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; page?: string; tab?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const page = Number(params.page ?? 1);

  let cluster:
    | Awaited<ReturnType<typeof listAdminClusterVps>>
    | null = null;
  let clusterError: string | null = null;

  try {
    cluster = await listAdminClusterVps(actor.id, {
      q: params.q,
      source: params.source as import("@dior/backend").AdminClusterVpsSource | undefined,
      page,
      pageSize: 50,
    });
  } catch (err) {
    clusterError = err instanceof Error ? err.message : "Proxmox cluster unavailable";
  }

  const billingOther = await listAdminServices(actor.id, {
    page: 1,
    pageSize: 100,
  });
  const otherServices = billingOther.items.filter((s) => s.type !== "VPS");

  return (
    <>
      <PageHeader
        title="Services"
        description="Customer VPS on Proxmox (billing + Telegram bot)"
      />
      <PageContainer className="space-y-6">
        <Panel
          title="Customer VPS"
          description={
            cluster
              ? `${cluster.total} VM(s)`
              : clusterError ?? "Loading…"
          }
          noPadding
        >
          {clusterError ? (
            <p className="p-6 text-sm text-[var(--muted-foreground)]">{clusterError}</p>
          ) : cluster ? (
            <DataTable>
              <DataTableHead>
                <DataTableTh>VM</DataTableTh>
                <DataTableTh>IP</DataTableTh>
                <DataTableTh>Source</DataTableTh>
                <DataTableTh>Customer</DataTableTh>
                <DataTableTh>Status</DataTableTh>
                <DataTableTh align="right">MRR</DataTableTh>
                <DataTableTh align="right"> </DataTableTh>
              </DataTableHead>
              <DataTableBody>
                {cluster.items.length === 0 ? (
                  <DataTableEmpty message="No VMs on Proxmox" colSpan={7} />
                ) : (
                  cluster.items.map((vm) => (
                    <DataTableClickableRow
                      key={vm.vmid}
                      href={controlPath(vm.detailHref)}
                    >
                      <DataTableTd>
                        <p className="font-medium">{vm.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          VMID {vm.vmid} · {vm.node}
                        </p>
                      </DataTableTd>
                      <DataTableTd mono>{vm.ip ?? "—"}</DataTableTd>
                      <DataTableTd>
                        <AdminVpsSourceBadge source={vm.source} />
                      </DataTableTd>
                      <DataTableTd>
                        {vm.customerEmail ? (
                          <span className="text-sm">{vm.customerEmail}</span>
                        ) : vm.customerRef ? (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            TG: {vm.customerRef}
                          </span>
                        ) : (
                          "—"
                        )}
                      </DataTableTd>
                      <DataTableTd>
                        <Badge variant={vm.proxmoxStatus === "running" ? "success" : "muted"}>
                          {vm.billingStatus ?? vm.proxmoxStatus}
                        </Badge>
                      </DataTableTd>
                      <DataTableTd align="right" mono>
                        {vm.monthlyPrice != null ? formatMoney(vm.monthlyPrice) : "—"}
                      </DataTableTd>
                      <DataTableTd align="right">
                        <div className="flex items-center justify-end gap-2">
                          {vm.serviceId && (
                            <ServiceRowDelete serviceId={vm.serviceId} label={vm.name} />
                          )}
                          <Link
                            href={controlPath(vm.detailHref)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {vm.hasPassword ? "Credentials" : "Details"}
                          </Link>
                        </div>
                      </DataTableTd>
                    </DataTableClickableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          ) : null}
        </Panel>

        {otherServices.length > 0 && (
          <Panel
            title="Other billing services"
            description={`${otherServices.length} domain / dedicated / CDN`}
            noPadding
          >
            <DataTable>
              <DataTableHead>
                <DataTableTh>Service</DataTableTh>
                <DataTableTh>Type</DataTableTh>
                <DataTableTh>Customer</DataTableTh>
                <DataTableTh>Status</DataTableTh>
                <DataTableTh align="right">MRR</DataTableTh>
              </DataTableHead>
              <DataTableBody>
                {otherServices.map((s) => (
                  <DataTableClickableRow key={s.id} href={controlPath(`/services/${s.id}`)}>
                    <DataTableTd>
                      <p className="font-medium">{s.label}</p>
                    </DataTableTd>
                    <DataTableTd>{s.type}</DataTableTd>
                    <DataTableTd>{s.user.email}</DataTableTd>
                    <DataTableTd>
                      <Badge>{s.status}</Badge>
                    </DataTableTd>
                    <DataTableTd align="right" mono>
                      {formatMoney(Number(s.monthlyPrice))}
                    </DataTableTd>
                  </DataTableClickableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </Panel>
        )}
      </PageContainer>
    </>
  );
}
