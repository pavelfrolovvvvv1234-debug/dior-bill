"use client";

import { useMemo, useState, useTransition } from "react";
import { Panel } from "@/components/ui/enterprise/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  BULLETPROOF_DOMAIN_ZONES,
  getDomainZone,
  parseDomainInput,
  type DomainZone,
} from "@/lib/domain-zones";
import { cn } from "@/lib/utils";
import { searchDomainAction, registerDomainAction } from "@/app/actions/domains";
import { checkSufficientBalance } from "@/app/actions/order";
import { handlePurchaseError, toastInsufficientBalance } from "@/lib/toast";

type CheckState =
  | {
      fqdn: string;
      zone: DomainZone;
      available: boolean;
      premium: boolean;
      amperPrice: number;
    }
  | { error: string };

export function DomainsPlansTab({
  bulletproof = false,
  title,
  description,
  zones = bulletproof ? BULLETPROOF_DOMAIN_ZONES : [],
}: {
  bulletproof?: boolean;
  title?: string;
  description?: string;
  zones?: readonly DomainZone[];
} = {}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<CheckState | null>(null);
  const [searching, startSearch] = useTransition();
  const [purchasing, startPurchase] = useTransition();

  const showCatalog = bulletproof && zones.length > 0;

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseDomainInput(query);
    if (!parsed) {
      setChecked({ error: "Enter a valid domain name." });
      return;
    }
    const zone = getDomainZone(parsed.tld);
    if (!zone) {
      setChecked({ error: "Zone not in catalog. Pick a TLD from the list." });
      return;
    }

    startSearch(async () => {
      try {
        const result = await searchDomainAction(parsed.fqdn);
        setChecked({
          fqdn: result.domain,
          zone,
          available: result.available,
          premium: result.premium,
          amperPrice: result.amperPrice,
        });
      } catch (err) {
        setChecked({
          error: err instanceof Error ? err.message : "Could not check availability",
        });
      }
    });
  }

  function purchase() {
    if (!checked || "error" in checked || !checked.available) return;
    startPurchase(async () => {
      try {
        const { sufficient } = await checkSufficientBalance(checked.zone.priceYear);
        if (!sufficient) {
          toastInsufficientBalance();
          return;
        }
        await registerDomainAction(checked.fqdn, 1);
      } catch (err) {
        if (!handlePurchaseError(err)) {
          setChecked({
            error: err instanceof Error ? err.message : "Registration failed",
          });
        }
      }
    });
  }

  const zoneFilter = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\./, "");
    if (!q || q.includes(".")) return zones;
    return zones.filter((z) => z.tld.includes(q));
  }, [query, zones]);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        {showCatalog && (
          <Panel title="Available domain zones" noPadding>
            <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {zoneFilter.map((zone) => (
                <button
                  key={zone.tld}
                  type="button"
                  onClick={() => setQuery(`yourname.${zone.tld}`)}
                  className={cn(
                    "flex flex-col items-start gap-1 bg-card px-3 py-3 text-left transition-premium hover:bg-accent",
                    checked &&
                      !("error" in checked) &&
                      checked.zone.tld === zone.tld &&
                      "bg-primary/5 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <span className="font-mono text-sm font-semibold">.{zone.tld}</span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMoney(zone.priceYear)}/yr
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="xl:col-span-4">
        <Panel
          title="Register domain"
          description="Live availability via Amper registrar"
          className="xl:sticky xl:top-20"
        >
          <form onSubmit={runSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="yourbrand.com"
                className="pl-9"
              />
            </div>
            <Button type="submit" className="w-full" disabled={searching}>
              {searching ? "Checking…" : "Check availability"}
            </Button>
          </form>

          {checked && "error" in checked ? (
            <p className="mt-4 text-sm text-destructive">{checked.error}</p>
          ) : checked ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{checked.fqdn}</p>
                  <p className="text-xs text-muted-foreground">
                    1 year · registrar Amper
                    {checked.premium ? " · premium" : ""}
                  </p>
                </div>
                <Badge variant={checked.available ? "success" : "warning"}>
                  {checked.available ? "Available" : "Taken"}
                </Badge>
              </div>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney(checked.zone.priceYear)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </p>
              {checked.available && (
                <Button
                  type="button"
                  className="w-full"
                  size="sm"
                  disabled={purchasing}
                  onClick={purchase}
                >
                  {purchasing ? "Registering…" : "Purchase domain"}
                </Button>
              )}
            </div>
          ) : query.trim() && !parseDomainInput(query) ? (
            <p className="mt-4 text-sm text-destructive">Enter a valid domain name.</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Search a name or click a zone to prefill.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

