"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CONTROL_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const filtered = CONTROL_NAV.filter((n) =>
    n.label.toLowerCase().includes(q.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#0b1224] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/6 px-4">
          <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search modules…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            ESC
          </kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto py-2">
          {filtered.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  router.push(item.href);
                  setOpen(false);
                  setQ("");
                }}
              >
                <item.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                {item.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              No results
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
