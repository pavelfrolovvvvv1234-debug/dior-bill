"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { getControlNavForRole, isNavActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type ControlSidebarProps = {
  userRole: string;
};

export function ControlSidebar({ userRole }: ControlSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = getControlNavForRole(userRole);

  useEffect(() => {
    for (const item of nav) router.prefetch(item.href);
  }, [router, nav]);

  return (
    <aside className="pointer-events-auto fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-white/6 bg-[#070b14]/95 backdrop-blur-xl lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-white/6 px-4">
        <img src="/logo-icon.png" alt="" width={28} height={28} className="shrink-0" />
        <div>
          <p className="text-sm font-semibold leading-tight">DIOR</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-primary">Control</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-[var(--muted-foreground)] hover:bg-white/5 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/6 p-3">
        <Link
          href={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/dashboard"}
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Customer portal
        </Link>
      </div>
    </aside>
  );
}
