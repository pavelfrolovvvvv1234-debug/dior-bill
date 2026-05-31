"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { controlPath } from "@/lib/control-paths";
import { cn } from "@/lib/utils";

const TABS = [
  { href: controlPath("/billing"), label: "Overview", icon: LayoutDashboard, exact: true },
  { href: controlPath("/billing/invoices"), label: "Invoices", icon: FileText },
  { href: controlPath("/billing/top-ups"), label: "Top-ups", icon: Wallet },
  { href: controlPath("/billing/transactions"), label: "Ledger", icon: ArrowLeftRight },
  { href: controlPath("/billing/reconciliation"), label: "Reconcile", icon: RefreshCw },
];

export function BillingSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-white/5 hover:text-foreground",
            )}
          >
            <tab.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
