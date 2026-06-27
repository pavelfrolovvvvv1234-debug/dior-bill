import Link from "next/link";
import { adminGetDomainNameservers, getAdminServiceDetail, getAdminVpsAccessByServiceId } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { ServiceActions } from "@/components/control/service-actions";
import { AdminVpsCredentialsPanel } from "@/components/control/admin-vps-credentials";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { notFound } from "next/navigation";
import { AdminDomainNameservers } from "@/components/control/admin-domain-nameservers";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireControlSession();

  let service;
  try {
    service = await getAdminServiceDetail(actor.id, id);
  } catch {
    notFound();
  }

  const ip =
    service.vpsInstance?.primaryIp ??
    service.dedicatedServer?.primaryIp ??
    service.domain?.domainName ??
    service.cdnZone?.zoneName;

  const domainNs =
    service.type === "DOMAIN" && service.domain
      ? await adminGetDomainNameservers(actor.id, service.id)
      : null;

  const vpsAccess =
    service.type === "VPS" && service.vpsInstance
      ? await getAdminVpsAccessByServiceId(actor.id, service.id)
      : null;

  const proxmoxDetailHref =
    service.vpsInstance?.proxmoxVmid != null
      ? controlPath(`/vms/${service.vpsInstance.proxmoxVmid}`)
      : null;

  return (
    <>
      <PageHeader
        title={service.label}
        description={`${service.type} · ${service.id}`}
        actions={<ServiceActions serviceId={service.id} status={service.status} label={service.label} />}
      />
      <PageContainer>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Status", value: service.status },
            { label: "MRR", value: formatMoney(Number(service.monthlyPrice)) },
            {
              label: "Auto renew",
              value: service.autoRenew ? "Yes" : "No",
            },
            { label: "Created", value: <LocalDateTime value={service.createdAt} /> },
          ].map((k) => (
            <div key={k.label} className="panel p-4">
              <p className="text-xs text-[var(--muted-foreground)]">{k.label}</p>
              <p className="mt-1 text-xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Customer">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Email</dt>
                <dd>
                  <Link href={controlPath(`/users/${service.user.id}`)} className="hover:text-primary">
                    {service.user.email}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">User status</dt>
                <dd>
                  <Badge>{service.user.status}</Badge>
                </dd>
              </div>
              {ip && (
                <div className="flex justify-between">
                  <dt className="text-[var(--muted-foreground)]">Endpoint</dt>
                  <dd className="font-mono text-xs">{ip}</dd>
                </div>
              )}
            </dl>
          </Panel>
          <Panel title="Technical">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Type</dt>
                <dd>{service.type}</dd>
              </div>
              {service.vpsInstance && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted-foreground)]">Hostname</dt>
                    <dd>{service.vpsInstance.hostname ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted-foreground)]">Node</dt>
                    <dd>{service.vpsInstance.node?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted-foreground)]">Location</dt>
                    <dd>
                      {service.vpsInstance.location
                        ? `${service.vpsInstance.location.code} · ${service.vpsInstance.location.country}`
                        : "—"}
                    </dd>
                  </div>
                </>
              )}
              {service.domain && (
                <div className="flex justify-between">
                  <dt className="text-[var(--muted-foreground)]">Expires</dt>
                  <dd>
                    {service.domain.expiresAt ? <LocalDateTime value={service.domain.expiresAt} mode="date" /> : "—"}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>

        {vpsAccess && (
          <AdminVpsCredentialsPanel
            username={vpsAccess.username}
            password={vpsAccess.password}
            host={vpsAccess.host}
            sshCommand={vpsAccess.sshCommand}
            rdpTarget={vpsAccess.rdpTarget}
            proxmoxVmid={vpsAccess.proxmoxVmid}
            osLabel={vpsAccess.osLabel}
          />
        )}

        {proxmoxDetailHref && (
          <p className="text-sm">
            <Link href={proxmoxDetailHref} className="font-medium text-primary hover:underline">
              Full Proxmox cluster details →
            </Link>
          </p>
        )}

        {domainNs && (
          <Panel title="Nameservers">
            <AdminDomainNameservers
              serviceId={service.id}
              initial={domainNs.nameservers}
              amperConfigured={domainNs.amperConfigured}
            />
          </Panel>
        )}

        <Panel title="Recent events">
          <ul className="space-y-2 text-xs text-[var(--muted-foreground)]">
            {service.events.map((e) => (
              <li key={e.id}>
                <LocalDateTime value={e.createdAt} /> — {e.type} · {e.title}
              </li>
            ))}
            {service.events.length === 0 && <p>No events</p>}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}


