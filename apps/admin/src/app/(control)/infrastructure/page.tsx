import { getInfrastructureOverview } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";

export default async function InfrastructurePage() {
  const actor = await requireControlSession();
  const data = await getInfrastructureOverview(actor.id);

  return (
    <>
      <PageHeader title="Infrastructure" description="Nodes, provisioning queue, IP pools, dedicated stock" />
      <PageContainer>
        <Panel title="Compute nodes">
          <ul className="space-y-3 text-sm">
            {data.nodes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 pb-3">
                <span className="font-medium">{n.name}</span>
                <span className="text-[var(--muted-foreground)]">
                  {n.location.country} · {n.activeVps} VPS · {n.loadPercent.toFixed(0)}% load
                </span>
                <Badge variant={n.status === "online" ? "success" : "warning"}>{n.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Provisioning queue" description={`${data.provisioningJobs.length} jobs`}>
          <ul className="space-y-2 text-sm">
            {data.provisioningJobs.map((j) => (
              <li key={j.id} className="flex justify-between">
                <span>{j.service.label} ({j.service.type})</span>
                <Badge>{j.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Dedicated inventory">
          <ul className="space-y-2 text-sm">
            {data.dedicatedStock.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.sku ?? d.id}</span>
                <span>{d.stockAvail} available · {d.location?.code ?? d.locationId}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
