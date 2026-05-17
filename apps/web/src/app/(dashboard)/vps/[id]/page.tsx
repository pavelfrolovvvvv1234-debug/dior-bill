import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { requireSession } from "@/lib/auth";
import {
  formatVpsOsLabel,
  getServiceTimeline,
  getVpsAccessInfo,
  getVpsById,
  refreshVpsLiveMetrics,
} from "@dior/backend";
import { ServiceTimeline } from "@/components/service-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { VpsDetailPanel } from "./vps-detail-panel";
import { Terminal } from "lucide-react";

export default async function VpsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  let vps;
  try {
    await refreshVpsLiveMetrics(id, session.user.id);
    vps = await getVpsById(id, session.user.id);
  } catch {
    notFound();
  }

  const [timeline, access] = await Promise.all([
    getServiceTimeline(vps.serviceId),
    getVpsAccessInfo(id, session.user.id),
  ]);

  const osLabel = formatVpsOsLabel(vps.os);
  const isActive = vps.service.status === "ACTIVE";
  const isProvisioning =
    vps.service.status === "PENDING" || vps.service.status === "PROVISIONING";

  return (
    <>
      <PageHeader
        title={vps.hostname}
        description={vps.primaryIp ?? "Provisioning — IP will appear when ready"}
        breadcrumbs={[
          { label: "My Services", href: "/services" },
          { label: vps.hostname },
        ]}
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="glass">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle>Instance details</CardTitle>
                <Badge variant={isActive ? "success" : "warning"}>
                  {vps.service.status}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Hostname", vps.hostname],
                  ["Primary IP", vps.primaryIp ?? "—"],
                  ["VM ID", vps.proxmoxVmid?.toString() ?? "—"],
                  ["Node", vps.node?.name ?? "—"],
                  ["Location", vps.location.name],
                  ["OS", osLabel],
                  [
                    "Plan",
                    `${vps.cpuCores} vCPU · ${vps.ramMb / 1024} GB RAM · ${vps.diskGb} GB disk`,
                  ],
                  ["Bandwidth", `${vps.bandwidthTb} TB / mo`],
                  ["Renews", vps.service.renewsAt ? formatDate(vps.service.renewsAt) : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Resource usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  ["CPU", vps.cpuUsage, `${vps.cpuCores} vCPU`],
                  ["RAM", vps.ramUsage, `${vps.ramMb / 1024} GB`],
                  ["Disk", vps.diskUsage, `${vps.diskGb} GB`],
                ].map(([label, val, cap]) => (
                  <div key={label as string}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{label}</span>
                      <span className="text-muted-foreground">
                        {val}% of {cap}
                      </span>
                    </div>
                    <Progress value={val as number} />
                  </div>
                ))}
                {isActive && vps.cpuUsage === 0 && vps.ramUsage === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Metrics refresh when you open this page. If the server is idle, usage may
                    show 0%.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Connection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {access.sshCommand ? (
                  <>
                    <p>
                      Connect from your terminal with the SSH command in{" "}
                      <strong className="text-foreground">Access credentials</strong> (right
                      column). Default port: <span className="font-mono">22</span>.
                    </p>
                    <p className="rounded-lg border border-white/8 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300">
                      {access.sshCommand}
                    </p>
                  </>
                ) : access.rdpTarget ? (
                  <p>
                    Use Remote Desktop (RDP) to <span className="font-mono">{access.rdpTarget}</span>{" "}
                    port <span className="font-mono">3389</span> with the Administrator password
                    from Access credentials.
                  </p>
                ) : (
                  <p>Connection details will be available after provisioning completes.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="glass lg:sticky lg:top-20">
              <CardHeader>
                <CardTitle>Access & actions</CardTitle>
              </CardHeader>
              <CardContent>
                <VpsDetailPanel
                  vpsId={vps.id}
                  access={access}
                  osLabel={osLabel}
                  actionsDisabled={isProvisioning || !vps.proxmoxVmid}
                />
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Service timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceTimeline events={timeline} />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
