export const dynamic = "force-dynamic";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getInfrastructureStatus } from "@dior/backend";
import { NodeMap } from "@/components/node-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@dior/shared";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const overallMeta = {
  operational: { label: "All systems operational", icon: CheckCircle2, variant: "success" as const },
  degraded: { label: "Degraded performance", icon: AlertTriangle, variant: "warning" as const },
  outage: { label: "Service disruption", icon: XCircle, variant: "destructive" as const },
};

export default async function StatusPage() {
  const status = await getInfrastructureStatus();
  const meta = overallMeta[status.overall];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/30 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo variant="mark" size={28} />
            <span className="font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Client area
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Infrastructure status</h1>
          <p className="mt-2 text-muted-foreground">
            Real-time availability across compute nodes and edge locations.
          </p>
        </div>

        <Card className="glass border-primary/20">
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <Icon className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="text-lg font-medium">{meta.label}</p>
              <p className="text-sm text-muted-foreground">
                Platform uptime {status.uptimePercent}% · {status.activeDeployments} active deployments
              </p>
            </div>
            <Badge variant={meta.variant}>{status.overall}</Badge>
          </CardContent>
        </Card>

        <NodeMap nodes={status.nodes} />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Compute nodes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status.nodes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{n.name}</p>
                    <p className="text-xs text-muted-foreground">{n.location}</p>
                  </div>
                  <div className="text-right text-sm">
                    <Badge variant={n.status === "online" ? "success" : "warning"}>{n.status}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      IPv4 {n.ipv4Available}/{n.ipv4Total} · {n.activeVps} VPS
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Edge locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status.edgeLocations.map((e) => (
                <div
                  key={e.code}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3"
                >
                  <span className="font-medium">{e.name}</span>
                  <Badge variant={e.status === "operational" ? "success" : "warning"}>
                    {e.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Last updated {new Date(status.updatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
