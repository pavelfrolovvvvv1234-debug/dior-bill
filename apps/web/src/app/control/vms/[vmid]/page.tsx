import Link from "next/link";
import { getAdminClusterVpsDetail } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import {
  AdminVpsCredentialsPanel,
  AdminVpsSourceBadge,
} from "@/components/control/admin-vps-credentials";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function AdminVpsDetailPage({
  params,
}: {
  params: Promise<{ vmid: string }>;
}) {
  const { vmid: vmidRaw } = await params;
  const vmid = Number.parseInt(vmidRaw, 10);
  if (!Number.isFinite(vmid)) notFound();

  const actor = await requireControlSession();

  let vm;
  try {
    vm = await getAdminClusterVpsDetail(actor.id, vmid);
  } catch {
    notFound();
  }

  const memPct =
    vm.proxmoxMetrics?.maxmem && vm.proxmoxMetrics.mem != null
      ? Math.round((vm.proxmoxMetrics.mem / vm.proxmoxMetrics.maxmem) * 100)
      : null;

  return (
    <>
      <PageHeader
        title={vm.name}
        description={`VMID ${vm.vmid} · ${vm.node} · Proxmox cluster`}
      />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Proxmox status", value: vm.proxmoxStatus },
            { label: "Source", value: <AdminVpsSourceBadge source={vm.source} /> },
            { label: "IP", value: vm.ip ?? "—" },
            {
              label: "Memory",
              value: memPct != null ? `${memPct}%` : "—",
            },
          ].map((k) => (
            <div key={k.label} className="panel p-4">
              <p className="text-xs text-[var(--muted-foreground)]">{k.label}</p>
              <p className="mt-1 text-xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>

        <AdminVpsCredentialsPanel
          username={vm.login}
          password={vm.password}
          host={vm.ip}
          sshCommand={vm.sshCommand}
          rdpTarget={vm.rdpTarget}
          proxmoxVmid={vm.vmid}
          osLabel={vm.os}
          passwordSource={vm.passwordSource}
          warnings={vm.warnings}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Ownership">
            <dl className="space-y-2 p-4 pt-0 text-sm">
              {vm.customerEmail && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">Billing customer</dt>
                  <dd>{vm.customerEmail}</dd>
                </div>
              )}
              {vm.customerRef && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">Telegram / external ref</dt>
                  <dd className="font-mono text-xs">{vm.customerRef}</dd>
                </div>
              )}
              {vm.billingStatus && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">Billing status</dt>
                  <dd>
                    <Badge>{vm.billingStatus}</Badge>
                  </dd>
                </div>
              )}
              {vm.monthlyPrice != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">MRR</dt>
                  <dd>{formatMoney(vm.monthlyPrice)}</dd>
                </div>
              )}
              {vm.serviceId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">Billing service</dt>
                  <dd>
                    <Link href={controlPath(`/services/${vm.serviceId}`)} className="text-primary hover:underline">
                      Open billing record
                    </Link>
                  </dd>
                </div>
              )}
              {vm.registry && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted-foreground)]">IP registry</dt>
                    <dd>
                      {vm.registry.owner} · {vm.registry.status}
                    </dd>
                  </div>
                  {vm.registry.externalServiceId && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--muted-foreground)]">Bot service ID</dt>
                      <dd className="font-mono text-xs">{vm.registry.externalServiceId}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </Panel>

          <Panel title="Resources">
            <dl className="space-y-2 p-4 pt-0 text-sm">
              {vm.billing ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted-foreground)]">Plan</dt>
                    <dd>
                      {vm.billing.cpuCores} vCPU · {vm.billing.ramMb} MB · {vm.billing.diskGb} GB
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted-foreground)]">Location</dt>
                    <dd>{vm.billing.location ?? "—"}</dd>
                  </div>
                </>
              ) : (
                <>
                  {vm.proxmoxConfig.cores && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--muted-foreground)]">vCPU</dt>
                      <dd>{vm.proxmoxConfig.cores}</dd>
                    </div>
                  )}
                  {vm.proxmoxConfig.memory && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--muted-foreground)]">RAM (MB)</dt>
                      <dd>{vm.proxmoxConfig.memory}</dd>
                    </div>
                  )}
                </>
              )}
              {vm.ipsFromConfig.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">IPs (config)</dt>
                  <dd className="font-mono text-xs">{vm.ipsFromConfig.join(", ")}</dd>
                </div>
              )}
              {vm.guestAgentIps.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted-foreground)]">IPs (guest agent)</dt>
                  <dd className="font-mono text-xs">{vm.guestAgentIps.join(", ")}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>
      </PageContainer>
    </>
  );
}
