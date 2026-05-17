"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  bandwidth: Math.random() * 80 + 20,
  hits: 85 + Math.random() * 10,
}));

export function CdnAnalytics({
  cacheHitRatio,
  edgeCount,
}: {
  cacheHitRatio: number;
  edgeCount: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Cache hit ratio</p>
          <p className="text-2xl font-semibold">{cacheHitRatio.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Edge regions</p>
          <p className="text-2xl font-semibold">{edgeCount}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-2xl font-semibold text-emerald-500">Active</p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Area type="monotone" dataKey="bandwidth" stroke="hsl(210 100% 50%)" fill="url(#bw)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
