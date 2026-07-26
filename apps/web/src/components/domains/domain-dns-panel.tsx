"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/store";
import {
  attachDomainDnsAction,
  createDomainDnsRecordAction,
  deleteDomainDnsRecordAction,
  listDomainDnsRecordsAction,
} from "@/app/actions/domains";

type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
};

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

type Props = {
  domainId: string;
  dnsManaged: boolean;
  amperDnsConfigured: boolean;
  onAttached: () => void;
};

export function DomainDnsPanel({
  domainId,
  dnsManaged,
  amperDnsConfigured,
  onAttached,
}: Props) {
  const { t } = useI18n();
  const [managed, setManaged] = useState(dnsManaged);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("A");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const loadRecords = useCallback(() => {
    if (!managed) return;
    startTransition(async () => {
      setError(null);
      const res = await listDomainDnsRecordsAction(domainId);
      if (!res.ok) {
        setError(res.error);
        setRecords([]);
        return;
      }
      setRecords(res.records);
    });
  }, [domainId, managed]);

  useEffect(() => {
    setManaged(dnsManaged);
  }, [dnsManaged]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  function attach() {
    startTransition(async () => {
      setError(null);
      const res = await attachDomainDnsAction(domainId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setManaged(true);
      onAttached();
      const list = await listDomainDnsRecordsAction(domainId);
      if (list.ok) setRecords(list.records);
    });
  }

  function addRecord() {
    startTransition(async () => {
      setError(null);
      const res = await createDomainDnsRecordAction(domainId, {
        type,
        name: name.trim() || "@",
        content: value.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRecords(res.records);
      setName("");
      setValue("");
    });
  }

  function removeRecord(recordId: string) {
    if (!recordId) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteDomainDnsRecordAction(domainId, recordId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRecords(res.records);
    });
  }

  if (!amperDnsConfigured) {
    return (
      <p className="text-sm text-muted-foreground">{t("domains.dnsNotConfigured")}</p>
    );
  }

  if (!managed) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t("domains.dnsMoveTitle")}</p>
          <p className="mt-2 border-l-2 border-muted-foreground/40 pl-3 text-sm text-muted-foreground">
            {t("domains.dnsMoveHint")}
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={attach}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("domains.dnsAttach")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">{t("domains.dnsMoveTitle")}</p>
        <p className="mt-2 border-l-2 border-muted-foreground/40 pl-3 text-sm text-muted-foreground">
          {t("domains.dnsActiveHint")}
        </p>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("domains.dnsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border/50">
          {records.map((row) => (
            <li
              key={row.id || `${row.type}-${row.name}-${row.content}`}
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 font-mono text-xs sm:text-sm">
                <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold uppercase">
                  {row.type}
                </span>
                <span className="text-muted-foreground">{row.name || "@"}</span>
                <span className="mx-2 text-muted-foreground/60">→</span>
                <span className="break-all">{row.content}</span>
              </div>
              {row.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={pending}
                  onClick={() => removeRecord(row.id)}
                  aria-label={t("domains.dnsDelete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={pending}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {RECORD_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("domains.dnsNamePlaceholder")}
          className="font-mono text-sm"
          disabled={pending}
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("domains.dnsValuePlaceholder")}
          className="font-mono text-sm sm:min-w-[12rem] sm:flex-1"
          disabled={pending}
        />
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={pending || !value.trim()}
          onClick={addRecord}
          aria-label={t("domains.dnsAdd")}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
