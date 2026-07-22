"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dior:dashboard:contacts-banner:v1";

/**
 * Soft contacts strip above the balance card.
 * Dismiss persists in localStorage; exit uses the same motion system as toasts.
 */
export function DashboardContactsBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* private mode */
    }
    setVisible(true);
  }, []);

  function dismiss() {
    if (exiting) return;
    setExiting(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setVisible(false), 280);
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "overflow-hidden transition-[opacity,transform,max-height,margin] ease-[cubic-bezier(0.22,1,0.36,1)]",
        exiting
          ? "max-h-0 -translate-y-1 opacity-0"
          : "max-h-28 translate-y-0 opacity-100",
      )}
      style={{ transitionDuration: "280ms" }}
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 sm:items-center",
          !exiting && "motion-banner-enter",
        )}
        role="status"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-background/60 sm:mt-0">
          <MessageCircle className="h-4 w-4 text-primary" strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium tracking-tight text-foreground">
            {t("dashboard.contactsBanner.title")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("dashboard.contactsBanner.body")}{" "}
            <a
              href="https://t.me/diorhost_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/90 hover:underline"
            >
              @diorhost_bot
            </a>
            <span className="text-muted-foreground/70"> · </span>
            <a
              href="https://t.me/diorhost"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/90 hover:underline"
            >
              @diorhost
            </a>
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          aria-label={t("dashboard.contactsBanner.dismiss")}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
