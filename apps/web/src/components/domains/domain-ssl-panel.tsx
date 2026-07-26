"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";
import { getDomainSslStatusAction, issueDomainSslAction } from "@/app/actions/domains";

type Props = {
  domainId: string;
  dnsManaged: boolean;
};

export function DomainSslPanel({ domainId, dnsManaged }: Props) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [available, setAvailable] = useState(dnsManaged);

  useEffect(() => {
    if (!dnsManaged) {
      setAvailable(false);
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await getDomainSslStatusAction(domainId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAvailable(res.available);
      const ssl = res.ssl;
      if (!ssl) {
        setStatusText(null);
        return;
      }
      const parts = [
        ssl.status ?? ssl.state,
        ssl.mode ?? ssl.sslMode,
        ssl.issuer,
        ssl.expiresAt ?? ssl.expires_at,
        ssl.message,
      ]
        .filter(Boolean)
        .map(String);
      setStatusText(parts.length > 0 ? parts.join(" · ") : t("domains.sslUnknown"));
    });
  }, [domainId, dnsManaged, t]);

  function issue() {
    startTransition(async () => {
      setError(null);
      const res = await issueDomainSslAction(domainId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const ssl = res.ssl;
      const parts = [ssl.status ?? ssl.state, ssl.message].filter(Boolean).map(String);
      setStatusText(parts.length > 0 ? parts.join(" · ") : t("domains.sslIssued"));
    });
  }

  if (!available) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("domains.sslNeedDns")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">{t("domains.sslTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusText ?? t("domains.sslLoading")}
          </p>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={pending} onClick={issue}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("domains.sslIssue")}
      </Button>
    </div>
  );
}
