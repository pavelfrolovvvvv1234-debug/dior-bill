"use client";

import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
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
import { useI18n } from "@/lib/i18n/store";
import { ArrowUpRight, Plus, Wallet } from "lucide-react";
import type { DashboardStats } from "@dior/shared";
import { DashboardMyServices } from "@/components/dashboard/dashboard-my-services";
import { DashboardServiceCatalog } from "@/components/dashboard/dashboard-service-catalog";

type RawService = Parameters<typeof toServiceRow>[0] & { monthlyPrice: unknown };

interface Props {
  stats: DashboardStats;
  services: RawService[];
}

export function DashboardContent({ stats, services }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background">
            <Wallet className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("billing.availableBalance")}
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatMoney(stats.balance)}
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 gap-1.5 px-4" asChild>
          <FastLink href="/billing/topup">
            <Plus className="h-4 w-4" />
            {t("dashboard.topUpBalance")}
          </FastLink>
        </Button>
      </div>

      <DashboardMyServices services={services} />
      <DashboardServiceCatalog />
    </div>
  );
}
