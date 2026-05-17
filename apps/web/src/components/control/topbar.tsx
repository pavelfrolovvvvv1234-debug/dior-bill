"use client";

import { Search } from "lucide-react";
import type { ControlUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export function ControlTopbar({ user }: { user: ControlUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-white/6 bg-[#070b14]/80 px-4 backdrop-blur-xl lg:px-6">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="ml-4 rounded border border-white/10 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>
      <div className="flex items-center gap-3">
        <Badge>{user.role.replace("_", " ")}</Badge>
        <span className="max-w-[180px] truncate text-sm text-[var(--muted-foreground)]">
          {user.email}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
          {(user.email ?? "A")[0]?.toUpperCase()}
        </div>
      </div>
    </header>
  );
}
