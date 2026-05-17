import Link from "next/link";
import { Header } from "@/components/layout/header";
import { requireSession } from "@/lib/auth";
import { getInfrastructureFeed, getInfrastructureStatus } from "@dior/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeMap } from "@/components/node-map";
import { formatRelative } from "@/lib/utils";

export default async function InfrastructurePage() {
  const session = await requireSession();
  const [{ items }, status] = await Promise.all([
    getInfrastructureFeed(1, 30),
    getInfrastructureStatus(),
  ]);

  return (
    <>
      <Header title="Infrastructure" description="Live network & capacity updates" user={session.user} />
      <div className="space-y-6 p-6">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Node map</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/status">Public status page</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <NodeMap nodes={status.nodes} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {status.nodes.map((n) => (
            <Card key={n.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{n.name}</p>
                  <Badge variant={n.status === "online" ? "success" : "warning"}>{n.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{n.location}</p>
                <p className="mt-3 text-sm">
                  Capacity <span className="font-mono">{n.capacityPercent.toFixed(0)}%</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  IPv4 {n.ipv4Available}/{n.ipv4Total} · {n.activeVps} VPS
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="max-w-3xl space-y-4">
          <h2 className="text-lg font-semibold">Network feed</h2>
          {items.map((item) => (
            <Card key={item.id} className={`glass ${item.pinned ? "border-primary/40" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Badge>{item.type}</Badge>
                  {item.pinned && <Badge variant="default">Pinned</Badge>}
                </div>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">{formatRelative(item.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
