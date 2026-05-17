"use client";

import { cn } from "@/lib/utils";

export interface NodeMapPoint {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  capacityPercent: number;
}

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(92, Math.max(8, y)) };
}

export function NodeMap({ nodes }: { nodes: NodeMapPoint[] }) {
  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-lg glass-surface shadow-float">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 100 50" preserveAspectRatio="none">
        <path
          d="M0,25 Q25,15 50,25 T100,25"
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="0.3"
        />
      </svg>
      {nodes.map((node) => {
        const { x, y } = project(node.lat, node.lng);
        const online = node.status === "online";
        return (
          <div key={node.id} className="absolute group" style={{ left: `${x}%`, top: `${y}%` }}>
            <span
              className={cn(
                "absolute -inset-2 rounded-full opacity-60",
                online ? "bg-emerald-500/15" : "bg-amber-500/15",
              )}
            />
            <span
              className={cn(
                "relative block h-2.5 w-2.5 rounded-full border-2 border-[#070b14] shadow-[0_0_12px_rgba(59,130,246,0.2)]",
                online ? "bg-emerald-500" : "bg-amber-500",
              )}
              title={`${node.name} · ${node.location}`}
            />
            <div className="pointer-events-none absolute left-4 top-0 z-10 hidden w-48 rounded-md glass-surface p-2.5 text-xs shadow-float group-hover:block">
              <p className="font-medium">{node.name}</p>
              <p className="text-muted-foreground">{node.location}</p>
              <p className="mt-1 tabular-nums text-muted-foreground">
                Capacity {node.capacityPercent.toFixed(0)}%
              </p>
            </div>
          </div>
        );
      })}
      <p className="absolute bottom-2 right-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Global nodes
      </p>
    </div>
  );
}

