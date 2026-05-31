"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/enterprise/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { BULLETPROOF_DOMAIN_ZONES, parseDomainSearchInput } from "@/lib/domain-zones";
import { cn } from "@/lib/utils";
import { registerDomainAction, searchDomainsBulkAction } from "@/app/actions/domains";
import { checkSufficientBalance } from "@/app/actions/order";
import { handlePurchaseError, toastInsufficientBalance, useToastStore } from "@/lib/toast";
import { useI18n } from "@/lib/i18n/store";

type SearchResult = Awaited<ReturnType<typeof searchDomainsBulkAction>>["results"][number];

export function DomainsPlansTab({
  bulletproof = false,
  title,
  description,
  zones = bulletproof ? BULLETPROOF_DOMAIN_ZONES : [],
  spendableBalance = 0,
}: {
  bulletproof?: boolean;
  title?: string;
  description?: string;
  zones?: readonly { tld: string; priceYear: number }[];
  spendableBalance?: number;
} = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const pushToast = useToastStore((s) => s.push);
  const [query, setQuery] = useState("");
  const [searchedLabel, setSearchedLabel] = useState<string | null>(null);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);

  const showCatalog = bulletproof && zones.length > 0;

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseDomainSearchInput(query);
    if (!parsed) {
      setError("Enter a valid domain name — letters, numbers, and hyphens only.");
      setResults([]);
      setSearchedLabel(null);
      setPrimaryDomain(null);
      return;
    }

    startSearch(async () => {
      try {
        const data = await searchDomainsBulkAction(query);
        setSearchedLabel(data.label);
        setPrimaryDomain(data.primaryDomain);
        setResults(data.results);
        if (data.results.length === 0) {
          setError("No supported extensions found for this name.");
        }
      } catch (err) {
        setResults([]);
        setSearchedLabel(null);
        setPrimaryDomain(null);
        setError(err instanceof Error ? err.message : "Could not check availability");
      }
    });
  }

  async function purchase(domain: string, price: number) {
    setPurchaseError(null);
    setPurchasingDomain(domain);
    try {
      const { sufficient } = await checkSufficientBalance(price);
      if (!sufficient) {
        toastInsufficientBalance();
        setPurchaseError(
          t("domains.insufficientBalance", {
            required: formatMoney(price),
            available: formatMoney(spendableBalance),
          }),
        );
        return;
      }
      const result = await registerDomainAction(domain, 1);
      pushToast({
        variant: "success",
        title: t("domains.registerSuccessTitle"),
        description: t("domains.registerSuccessDesc", { domain: result.domainName }),
      });
      router.push(`/domains/${result.domainId}`);
    } catch (err) {
      if (isRedirectError(err)) throw err;
      if (!handlePurchaseError(err)) {
        const message = err instanceof Error ? err.message : t("domains.registerFailed");
        setPurchaseError(message);
        pushToast({
          variant: "error",
          title: t("domains.registerFailed"),
          description: message,
        });
      }
    } finally {
      setPurchasingDomain(null);
    }
  }

  function canAfford(price: number) {
    return spendableBalance >= price;
  }

  const primaryResult = useMemo(() => {
    if (!primaryDomain) return undefined;
    const exact = results.find((r) => r.domain === primaryDomain);
    if (exact) return exact;
    return results.find((r) => r.domain.toLowerCase() === primaryDomain.toLowerCase());
  }, [primaryDomain, results]);

  const otherResults = useMemo(
    () => (primaryDomain ? results.filter((r) => r.domain !== primaryDomain) : results),
    [primaryDomain, results],
  );

  const availableCount = useMemo(
    () => results.filter((r) => r.available && r.inCatalog).length,
    [results],
  );

  function renderRegisterButton(domain: string, price: number, size: "sm" | "default" = "sm") {
    const isPurchasing = purchasingDomain === domain;
    const affordable = canAfford(price);

    if (!affordable) {
      return (
        <Button size={size} className={size === "sm" ? "h-8 min-w-[6.5rem]" : undefined} asChild>
          <Link href="/billing/topup">{t("domains.addFunds")}</Link>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        size={size}
        className={size === "sm" ? "h-8 min-w-[6.5rem]" : undefined}
        disabled={purchasingDomain != null}
        onClick={() => purchase(domain, price)}
      >
        {isPurchasing ? (
          <Loader2 className={size === "sm" ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
        ) : (
          t("domains.registerNow")
        )}
      </Button>
    );
  }

  function renderResultRow(row: SearchResult, highlight = false) {
    const price = row.catalogPrice ?? 0;
    const canBuy = row.available && row.inCatalog;

    return (
      <div
        key={row.domain}
        className={cn(
          "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
          highlight && "bg-primary/[0.04]",
        )}
      >
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{row.domain}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            1 year registration
            {row.premium ? " · premium" : ""}
            {!row.inCatalog ? " · not in catalog" : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Badge variant={row.available ? "success" : "warning"} className="shrink-0 capitalize">
            {row.available ? "Available" : "Taken"}
          </Badge>

          {row.inCatalog ? (
            <p className="min-w-[5.5rem] text-right font-semibold tabular-nums">
              {formatMoney(price)}
              <span className="text-xs font-normal text-muted-foreground">/yr</span>
            </p>
          ) : null}

          {canBuy ? renderRegisterButton(row.domain, price) : (
            <div className="h-8 min-w-[6.5rem]" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {title ? <h3 className="text-base font-semibold tracking-tight">{title}</h3> : null}
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}

      <Panel title="Find your domain" description="Enter a name with or without an extension">
        <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a domain name, e.g. mybrand.com"
              className="h-11 pl-9 text-base"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" className="h-11 shrink-0 px-6" disabled={searching}>
            {searching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching…
              </>
            ) : (
              "Search"
            )}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Type <span className="font-mono">mybrand</span> to check popular extensions, or{" "}
          <span className="font-mono">mybrand.io</span> for a specific TLD.
        </p>
      </Panel>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {purchaseError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">{t("domains.registerFailed")}</p>
          <p className="mt-1">{purchaseError}</p>
        </div>
      ) : null}

      {searchedLabel ? (
        <p className="text-xs text-muted-foreground">
          {t("domains.balanceHint", {
            balance: formatMoney(spendableBalance),
          })}
        </p>
      ) : null}

      {primaryResult && primaryDomain ? (
        <div
          className={cn(
            "rounded-lg border px-5 py-5 sm:px-6",
            primaryResult.available && primaryResult.inCatalog
              ? "border-success/40 bg-success/[0.06]"
              : "border-border bg-muted/20",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              {primaryResult.available && primaryResult.inCatalog ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2} />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2} />
              )}
              <div>
                <p className="font-mono text-lg font-semibold tracking-tight">{primaryDomain}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {primaryResult.available && primaryResult.inCatalog
                    ? t("domains.exactAvailableDesc")
                    : t("domains.exactTakenDesc")}
                </p>
              </div>
            </div>

            {primaryResult.available && primaryResult.inCatalog ? (
              <div className="flex shrink-0 items-center gap-4">
                <p className="text-xl font-semibold tabular-nums">
                  {formatMoney(primaryResult.catalogPrice ?? 0)}
                  <span className="text-sm font-normal text-muted-foreground">/yr</span>
                </p>
                {renderRegisterButton(
                  primaryDomain,
                  primaryResult.catalogPrice ?? 0,
                  "default",
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {searchedLabel && otherResults.length > 0 ? (
        <Panel
          title={primaryResult ? t("domains.otherExtensions") : `Results for ${searchedLabel}`}
          description={
            availableCount > 0
              ? `${availableCount} available extension${availableCount === 1 ? "" : "s"} in our catalog`
              : "No available extensions in our catalog"
          }
          noPadding
        >
          <div className="divide-y divide-border">
            {otherResults.map((row) => renderResultRow(row))}
          </div>
        </Panel>
      ) : null}

      {showCatalog ? (
        <Panel title="All supported extensions" description="Annual pricing per TLD">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {zones.map((zone) => (
              <button
                key={zone.tld}
                type="button"
                onClick={() => {
                  const label = searchedLabel ?? parseDomainSearchInput(query)?.label ?? "yourname";
                  setQuery(`${label}.${zone.tld}`);
                }}
                className={cn(
                  "rounded-md border border-border px-3 py-2 text-left transition-premium",
                  "hover:border-foreground/20 hover:bg-accent/40",
                )}
              >
                <span className="font-mono text-sm font-medium">.{zone.tld}</span>
                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                  {formatMoney(zone.priceYear)}/yr
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
