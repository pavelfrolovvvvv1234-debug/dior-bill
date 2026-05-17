"use client";

import { useMemo, useState } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/enterprise/panel";
import { SegmentedControl } from "@/components/ui/enterprise/segmented-control";
import { StatusIndicator, mapServiceStatus } from "@/components/ui/enterprise/status-indicator";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/ui/enterprise/data-table";
import { ServiceQuickActions } from "./service-quick-actions";
import {
  type ServiceFilter,
  type ServiceRow,
  SERVICE_TYPE_LABELS,
  filterServices,
  groupServicesByType,
  sortServices,
  statusLabel,
} from "@/lib/service-catalog";
import { formatDate } from "@/lib/utils";
import { Plus, Server } from "lucide-react";
import type { ServiceType } from "@dior/database";

const FILTER_OPTIONS: { id: ServiceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "provisioning", label: "Provisioning" },
  { id: "inactive", label: "Suspended / expired" },
];

export function MyServicesView({ rows }: { rows: ServiceRow[] }) {
  const [filter, setFilter] = useState<ServiceFilter>("all");

  const filtered = useMemo(() => {
    return sortServices(filterServices(rows, filter));
  }, [rows, filter]);

  const grouped = useMemo(() => groupServicesByType(filtered), [filtered]);

  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;

  if (rows.length === 0) {
    return (
      <Panel>
        <div className="flex flex-col items-center py-16 text-center">
          <Server className="mb-4 h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
          <p className="font-medium">No services yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Provision VPS, dedicated hardware, domains, or CDN from the unified marketplace.
          </p>
          <Button className="mt-6 h-9" asChild>
            <FastLink href="/plans">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Select plan
            </FastLink>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{activeCount}</span> active ·{" "}
          <span className="font-medium text-foreground">{rows.length}</span> total
        </p>
        <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={setFilter} className="sm:max-w-xl" />
      </div>

      {Array.from(grouped.entries()).map(([type, group]) => (
        <ServiceTypeSection key={type} type={type} rows={group} />
      ))}

      {filtered.length === 0 && (
        <Panel>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No services match this filter.
          </p>
        </Panel>
      )}
    </div>
  );
}

function ServiceTypeSection({ type, rows }: { type: ServiceType; rows: ServiceRow[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {SERVICE_TYPE_LABELS[type]}
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <ServiceCard key={row.id} row={row} />
        ))}
      </div>

      <Panel className="hidden lg:block" noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>Service</DataTableTh>
            <DataTableTh>Status</DataTableTh>
            <DataTableTh>Endpoint</DataTableTh>
            <DataTableTh>Region</DataTableTh>
            <DataTableTh>Plan</DataTableTh>
            <DataTableTh>Renews</DataTableTh>
            <DataTableTh align="right">Actions</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableTd>
                  <FastLink href={row.manageHref} className="font-medium hover:text-primary">
                    {row.name}
                  </FastLink>
                </DataTableTd>
                <DataTableTd>
                  <StatusIndicator status={mapServiceStatus(row.status)} label={statusLabel(row.status)} />
                </DataTableTd>
                <DataTableTd mono className="text-muted-foreground">
                  {row.detail}
                </DataTableTd>
                <DataTableTd>{row.region}</DataTableTd>
                <DataTableTd className="text-muted-foreground">{row.plan}</DataTableTd>
                <DataTableTd className="text-muted-foreground">
                  {row.renewsAt ? formatDate(row.renewsAt) : "—"}
                </DataTableTd>
                <DataTableTd align="right">
                  <ServiceQuickActions manageHref={row.manageHref} />
                </DataTableTd>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Panel>
    </section>
  );
}

function ServiceCard({ row }: { row: ServiceRow }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-4 transition-premium hover:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <FastLink href={row.manageHref} className="font-medium hover:text-primary">
            {row.name}
          </FastLink>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.detail}</p>
        </div>
        <StatusIndicator status={mapServiceStatus(row.status)} label={statusLabel(row.status)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>{row.region}</span>
        <span className="text-right">{row.plan}</span>
      </div>
      <div className="mt-3 border-t border-white/6 pt-3">
        <ServiceQuickActions manageHref={row.manageHref} />
      </div>
    </div>
  );
}
