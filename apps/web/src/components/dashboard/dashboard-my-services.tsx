"use client";

import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import {
  StatusIndicator,
  mapServiceStatus,
} from "@/components/ui/enterprise/status-indicator";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/ui/enterprise/data-table";
import { toServiceRow, sortServices } from "@/lib/service-catalog";
import { formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { translateServiceDetail } from "@/lib/service-detail-i18n";
import { useI18n } from "@/lib/i18n/store";
import { ArrowUpRight, Plus } from "lucide-react";
import type { ServiceStatus } from "@dior/database";

type RawService = Parameters<typeof toServiceRow>[0] & { monthlyPrice: unknown };

export function DashboardMyServices({ services }: { services: RawService[] }) {
  const { t } = useI18n();
  const rows = sortServices(services.map(toServiceRow)).slice(0, 8);

  function serviceStatusLabel(status: ServiceStatus) {
    const key = `services.status.${status}`;
    const label = t(key);
    return label !== key ? label : status;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("dashboard.myServices")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("dashboard.myServicesDesc")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/plans">
              <Plus className="h-3.5 w-3.5" />
              {t("dashboard.addService")}
            </FastLink>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
            <FastLink href="/services">
              {t("common.viewAll")}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </FastLink>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <DataTable minWidth={720}>
          <DataTableHead>
            <DataTableTh>{t("dashboard.colName")}</DataTableTh>
            <DataTableTh>{t("services.plan")}</DataTableTh>
            <DataTableTh>{t("services.endpoint")}</DataTableTh>
            <DataTableTh align="right">{t("common.amount")}</DataTableTh>
            <DataTableTh>{t("common.status")}</DataTableTh>
            <DataTableTh>{t("services.renews")}</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {rows.length === 0 ? (
              <DataTableEmpty message={t("dashboard.noServicesHint")} colSpan={6} />
            ) : (
              rows.map((row) => {
                const raw = services.find((s) => s.id === row.id);
                const price = raw ? Number(raw.monthlyPrice) : 0;
                return (
                  <DataTableRow key={row.id}>
                    <DataTableTd>
                      <FastLink href={row.manageHref} className="font-medium hover:text-primary">
                        {row.name}
                      </FastLink>
                    </DataTableTd>
                    <DataTableTd className="max-w-[140px] truncate text-muted-foreground">
                      {row.plan}
                    </DataTableTd>
                    <DataTableTd mono className="text-muted-foreground">
                      {translateServiceDetail(row.detail, t)}
                    </DataTableTd>
                    <DataTableTd align="right" mono>
                      {formatMoney(price)}
                      <span className="text-muted-foreground">{t("plans.perMonth")}</span>
                    </DataTableTd>
                    <DataTableTd>
                      <StatusIndicator
                        status={mapServiceStatus(row.status)}
                        label={serviceStatusLabel(row.status)}
                      />
                    </DataTableTd>
                    <DataTableTd className="text-muted-foreground">
                      {row.renewsAt ? <LocalDateTime value={row.renewsAt} mode="date" /> : "—"}
                    </DataTableTd>
                  </DataTableRow>
                );
              })
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </section>
  );
}
