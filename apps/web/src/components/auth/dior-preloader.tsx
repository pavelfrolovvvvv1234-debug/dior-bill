"use client";

import { DiorWordmark } from "@/components/brand/dior-wordmark";
import { usePreloaderStore } from "@/stores/preloader-store";
import { cn } from "@/lib/utils";

export function DiorPreloader() {
  const phase = usePreloaderStore((s) => s.phase);

  if (phase === "hidden") return null;

  const isOpaque = phase === "visible" || phase === "completing";

  return (
    <div
      id="preloader"
      className={cn(
        "preloader",
        isOpaque && "preloader-visible",
        phase === "fadeout" && "preloader-fadeout",
      )}
      aria-hidden
    >
      <div className="preloader-content">
        <div className="logo-animation-group">
          <div className="preloader-logo">
            <DiorWordmark />
            <div className="logo-glow" />
          </div>
        </div>
      </div>
    </div>
  );
}
