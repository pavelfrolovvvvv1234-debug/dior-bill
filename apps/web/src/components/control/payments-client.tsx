"use client";

import { useState } from "react";
import Link from "next/link";
import { controlPath } from "@/lib/control-paths";

interface TopUpRow {
  id: string;
  referenceCode: string;
  amount: unknown;
  netAmount: unknown;
  provider: string;
  status: string;
  createdAt: string | Date;
  user: { email: string | null; displayName: string | null; telegramUsername: string | null };
}

interface Props {
  adminId: string;
  initial: {
    items: TopUpRow[];
    stats?: Array<{ status: string; _count: number; _sum: { amount: unknown } }>;
  };
}

export function AdminPaymentsClient({ initial }: Props) {
  const [items, setItems] = useState(initial.items);
  const [loading, setLoading] = useState<string | null>(null);
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

  async function approve(id: string, partial?: number) {
    setLoading(id);
    try {
      await fetch(`${api}/api/admin/topups/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partialAmount: partial, notes: "Approved via DIOR CONTROL" }),
      });
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "PAID" } : t)));
    } finally {
      setLoading(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    setLoading(id);
    try {
      await fetch(`${api}/api/admin/topups/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "FAILED" } : t)));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <FilterLink href={controlPath("/payments")}>All</FilterLink>
        <FilterLink href={`${controlPath("/payments")}?manual=true`}>Manual review</FilterLink>
        <FilterLink href={`${controlPath("/payments")}?status=MANUAL_REVIEW`}>Pending approval</FilterLink>
        <FilterLink href={`${controlPath("/payments")}?status=PAID`}>Completed</FilterLink>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="p-3 font-medium">Reference</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Provider</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((t) => (
              <tr key={t.id} className="data-row-hover">
                <td className="p-3 font-mono text-xs">{t.referenceCode}</td>
                <td className="p-3">
                  {t.user.email ?? (t.user.telegramUsername ? `@${t.user.telegramUsername}` : "—")}
                </td>
                <td className="p-3">{t.provider}</td>
                <td className="p-3">${Number(t.amount).toFixed(2)}</td>
                <td className="p-3">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{t.status}</span>
                </td>
                <td className="p-3">
                  {t.status === "MANUAL_REVIEW" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={loading === t.id}
                        onClick={() => approve(t.id)}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading === t.id}
                        onClick={() => reject(t.id)}
                        className="rounded-md bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-500"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
    >
      {children}
    </Link>
  );
}
