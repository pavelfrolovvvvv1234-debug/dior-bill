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
  filterServices,
  groupServicesByType,
  sortServices,
} from "@/lib/service-catalog";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Plus, Server } from "lucide-react";
import type { ServiceType, ServiceStatus } from "@dior/database";
import { useI18n } from "@/lib/i18n/store";

export function MyServicesView({ rows }: { rows: ServiceRow[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ServiceFilter>("all");

  const filterOptions = useMemo(
    () => [
      { id: "all" as const, label: t("services.filterAll") },
      { id: "active" as const, label: t("services.filterActive") },
      { id: "provisioning" as const, label: t("services.filterProvisioning") },
      { id: "inactive" as const, label: t("services.filterInactive") },
    ],
    [t],
  );

  const filtered = useMemo(() => sortServices(filterServices(rows, filter)), [rows, filter]);
  const grouped = useMemo(() => groupServicesByType(filtered), [filtered]);
  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;

  function serviceStatusLabel(status: ServiceStatus) {
    const key = `services.status.${status}`;
    const label = t(key);
    return label !== key ? label : status;
  }

  function serviceTypeLabel(type: ServiceType) {
    const key = `services.types.${type}`;
    const label = t(key);
    return label !== key ? label : type;
  }

  if (rows.length === 0) {
    return (
      <Panel>
        <div className="flex flex-col items-center py-16 text-center">
          <Server className="mb-4 h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
          <p className="font-medium">{t("services.empty")}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("services.emptyDesc")}</p>
          <Button className="mt-6 h-9" asChild>
            <FastLink href="/plans">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("services.selectPlan")}
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
          {t("services.activeTotal", { active: activeCount, total: rows.length })}
        </p>
        <SegmentedControl
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          className="sm:max-w-xl"
        />
      </div>

      {Array.from(grouped.entries()).map(([type, group]) => (
        <ServiceTypeSection
          key={type}
          type={type}
          rows={group}
          typeLabel={serviceTypeLabel(type)}
          statusLabel={serviceStatusLabel}
        />
      ))}

      {filtered.length === 0 && (
        <Panel>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("services.noMatch")}</p>
        </Panel>
      )}
    </div>
  );
}

function ServiceTypeSection({
  type,
  rows,
  typeLabel,
  statusLabel,
}: {
  type: ServiceType;
  rows: ServiceRow[];
  typeLabel: string;
  statusLabel: (status: ServiceStatus) => string;
}) {
  const { t } = useI18n();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {typeLabel}
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <ServiceCard key={row.id} row={row} statusLabel={statusLabel} />
        ))}
      </div>

      <Panel className="hidden lg:block" noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>{t("services.service")}</DataTableTh>
            <DataTableTh>{t("common.status")}</DataTableTh>
            <DataTableTh>{t("services.endpoint")}</DataTableTh>
            <DataTableTh>{t("services.region")}</DataTableTh>
            <DataTableTh>{t("services.plan")}</DataTableTh>
            <DataTableTh>{t("services.renews")}</DataTableTh>
            <DataTableTh align="right">{t("services.actions")}</DataTableTh>
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
                  <StatusIndicator
                    status={mapServiceStatus(row.status)}
                    label={statusLabel(row.status)}
                  />
                </DataTableTd>
                <DataTableTd mono className="text-muted-foreground">
                  {row.detail}
                </DataTableTd>
                <DataTableTd>{row.region}</DataTableTd>
                <DataTableTd className="text-muted-foreground">{row.plan}</DataTableTd>
                <DataTableTd className="text-muted-foreground">
                  {row.renewsAt ? <LocalDateTime value={row.renewsAt} mode="date" /> : "—"}
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

function ServiceCard({
  row,
  statusLabel,
}: {
  row: ServiceRow;
  statusLabel: (status: ServiceStatus) => string;
}) {
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
