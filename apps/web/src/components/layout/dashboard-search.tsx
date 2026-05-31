"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Layers,
  Loader2,
  Search,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { searchDashboardAction } from "@/app/actions/search";
import { Input } from "@/components/ui/input";
import { MAIN_NAV } from "@/lib/navigation";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

type RemoteResult = Awaited<ReturnType<typeof searchDashboardAction>>[number];

type PageResult = {
  id: string;
  title: string;
  href: string;
  category: "page";
};

type SearchResult = PageResult | RemoteResult;

const EXTRA_PAGES = [
  { href: "/billing/topup", labelKey: "breadcrumbs.addFunds" },
  { href: "/billing/transactions", labelKey: "breadcrumbs.transactions" },
] as const;

const CATEGORY_META: Record<
  SearchResult["category"],
  { labelKey: string; icon: LucideIcon }
> = {
  page: { labelKey: "search.pages", icon: Search },
  service: { labelKey: "search.services", icon: Layers },
  invoice: { labelKey: "search.invoices", icon: FileText },
  topup: { labelKey: "search.topUps", icon: Wallet },
};

function groupResults(results: SearchResult[]) {
  const groups = new Map<SearchResult["category"], SearchResult[]>();
  for (const row of results) {
    const list = groups.get(row.category) ?? [];
    list.push(row);
    groups.set(row.category, list);
  }
  return groups;
}

export function DashboardSearch() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<RemoteResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [] as PageResult[];

    const pages: PageResult[] = [];
    for (const item of MAIN_NAV) {
      const title = t(item.labelKey).toLowerCase();
      if (title.includes(q) || item.href.includes(q)) {
        pages.push({
          id: `page-${item.href}`,
          title: t(item.labelKey),
          href: item.href,
          category: "page",
        });
      }
    }
    for (const item of EXTRA_PAGES) {
      const title = t(item.labelKey).toLowerCase();
      if (title.includes(q) || item.href.includes(q)) {
        pages.push({
          id: `page-${item.href}`,
          title: t(item.labelKey),
          href: item.href,
          category: "page",
        });
      }
    }
    return pages.slice(0, 6);
  }, [query, t]);

  const results = useMemo(
    () => [...pageResults, ...remoteResults],
    [pageResults, remoteResults],
  );

  const flatResults = useMemo(() => {
    const grouped = groupResults(results);
    const order: SearchResult["category"][] = ["page", "service", "invoice", "topup"];
    return order.flatMap((category) => grouped.get(category) ?? []);
  }, [results]);

  const openPalette = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemoteResults([]);
    setActiveIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      closePalette();
    },
    [router, closePalette],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) requestAnimationFrame(() => inputRef.current?.focus());
          return !v;
        });
      }
      if (e.key === "Escape") closePalette();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePalette]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await searchDashboardAction(q);
          setRemoteResults(data);
        } catch {
          setRemoteResults([]);
        }
      });
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, remoteResults.length, pageResults.length]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && flatResults[activeIndex]) {
      e.preventDefault();
      navigate(flatResults[activeIndex].href);
    }
  }

  const grouped = groupResults(results);
  let runningIndex = 0;

  return (
    <>
      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:ml-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
        <Input
          readOnly
          onFocus={openPalette}
          onClick={openPalette}
          placeholder={t("topbar.searchPlaceholder")}
          className="h-9 cursor-pointer pl-9 text-sm"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={closePalette}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t("topbar.searchPlaceholder")}
                className="h-12 flex-1 bg-transparent text-sm outline-none"
              />
              {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>

            <div className="max-h-[min(24rem,50vh)] overflow-y-auto py-2">
              {flatResults.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {query.trim().length < 2 ? t("search.typeToSearch") : t("search.noResults")}
                </p>
              ) : (
                (["page", "service", "invoice", "topup"] as const).map((category) => {
                  const items = grouped.get(category);
                  if (!items?.length) return null;
                  const meta = CATEGORY_META[category];

                  return (
                    <div key={category} className="px-2 py-1">
                      <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t(meta.labelKey)}
                      </p>
                      <ul>
                        {items.map((item) => {
                          const index = runningIndex++;
                          const Icon = meta.icon;
                          const active = index === activeIndex;

                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-premium",
                                  active ? "bg-primary/10 text-foreground" : "hover:bg-accent",
                                )}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => navigate(item.href)}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    active ? "text-primary" : "text-muted-foreground",
                                  )}
                                  strokeWidth={1.75}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{item.title}</p>
                                  {"subtitle" in item && item.subtitle ? (
                                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
