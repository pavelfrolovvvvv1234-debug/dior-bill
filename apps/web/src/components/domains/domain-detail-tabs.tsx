"use client";

import { useState } from "react";
import { FileText, Globe, Lock, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/store";
import { CustomerDomainNameservers } from "./customer-domain-nameservers";
import { DomainDnsPanel } from "./domain-dns-panel";
import { DomainSslPanel } from "./domain-ssl-panel";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Badge } from "@/components/ui/badge";

type TabId = "info" | "ns" | "dns" | "ssl";

type Props = {
  domainId: string;
  domainName: string;
  registrar: string;
  status: string;
  serviceStatus: string;
  expiresAt: Date | string | null;
  autoRenew: boolean;
  initialNs: string[];
  amperConfigured: boolean;
  dnsManaged: boolean;
  amperDnsConfigured: boolean;
};

export function DomainDetailTabs({
  domainId,
  domainName,
  registrar,
  status,
  serviceStatus,
  expiresAt,
  autoRenew,
  initialNs,
  amperConfigured,
  dnsManaged,
  amperDnsConfigured,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("info");
  const [managed, setManaged] = useState(dnsManaged);

  const tabs: Array<{ id: TabId; label: string; icon: typeof Globe }> = [
    { id: "info", label: t("domains.tabInfo"), icon: Globe },
    { id: "ns", label: t("domains.tabNs"), icon: Server },
    { id: "dns", label: t("domains.tabDns"), icon: FileText },
    { id: "ssl", label: t("domains.tabSsl"), icon: Lock },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary/15 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 sm:p-6">
        {tab === "info" ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-lg font-semibold tracking-tight">{domainName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("domains.infoDesc")}</p>
              </div>
              <Badge variant={serviceStatus === "ACTIVE" ? "success" : "warning"}>
                {serviceStatus}
              </Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                [t("domains.infoRegistrar"), registrar],
                [t("domains.infoStatus"), status],
                [
                  t("domains.infoExpires"),
                  expiresAt ? <LocalDateTime value={expiresAt} mode="date" /> : "—",
                ],
                [t("domains.infoAutoRenew"), autoRenew ? t("domains.enabled") : t("domains.disabled")],
                [
                  t("domains.infoDns"),
                  managed ? t("domains.dnsManagedOn") : t("domains.dnsManagedOff"),
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between gap-4 rounded-lg border border-border/40 px-3 py-2.5"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {tab === "ns" ? (
          <CustomerDomainNameservers
            domainId={domainId}
            initial={initialNs}
            amperConfigured={amperConfigured}
          />
        ) : null}

        {tab === "dns" ? (
          <DomainDnsPanel
            domainId={domainId}
            dnsManaged={managed}
            amperDnsConfigured={amperDnsConfigured}
            onAttached={() => setManaged(true)}
          />
        ) : null}

        {tab === "ssl" ? (
          <DomainSslPanel domainId={domainId} dnsManaged={managed} />
        ) : null}
      </div>
    </div>
  );
}
