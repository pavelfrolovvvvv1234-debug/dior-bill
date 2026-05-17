"use client";

import { FastLink } from "@/components/ui/fast-link";
import { Activity, Server, CreditCard, Cog } from "lucide-react";
import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  at: Date;
  severity?: string;
  link?: string;
}

const kindIcon: Record<string, typeof Activity> = {
  service: Server,
  provision: Cog,
  billing: CreditCard,
};

export function ActivityCenter({ items }: { items: ActivityItem[] }) {
  return (
    <Panel
      title="Activity center"
      description="Deploys, billing, and service updates"
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          items.map((item) => {
            const Icon = kindIcon[item.kind] ?? Activity;
            const row = (
              <div className="flex gap-3 rounded-md border border-white/6 bg-white/[0.02] p-3 transition-premium hover:border-white/10 hover:bg-white/[0.04]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/6 bg-white/[0.03]">
                  <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    {item.severity && (
                      <Badge variant="muted" className="shrink-0 text-[10px]">
                        {item.severity}
                      </Badge>
                    )}
                  </div>
                  {item.subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatRelative(item.at)}</p>
                </div>
              </div>
            );
            return item.link ? (
              <FastLink key={item.id} href={item.link} className="block">
                {row}
              </FastLink>
            ) : (
              <div key={item.id}>{row}</div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
