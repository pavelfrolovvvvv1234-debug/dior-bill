"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Thin top bar — shows immediately on internal navigation click */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor?.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      try {
        const url = new URL(anchor.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === pathname && !url.search) return;
        setActive(true);
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[2px] overflow-hidden"
      role="progressbar"
      aria-hidden
    >
      <div className="h-full w-[28%] animate-[nav-progress_1.4s_cubic-bezier(0.4,0,0.2,1)_infinite] bg-primary/90" />
    </div>
  );
}
