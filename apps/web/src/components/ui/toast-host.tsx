"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/lib/toast";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";
import { FastLink } from "@/components/ui/fast-link";

const ICONS: Record<ToastVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const STYLES: Record<ToastVariant, string> = {
  error: "border-red-500/30 bg-red-500/10",
  success: "border-emerald-500/30 bg-emerald-500/10",
  info: "border-primary/30 bg-primary/10",
};

export function ToastHost() {
  const { t } = useI18n();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <motion.div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={cn(
                "pointer-events-auto glass shadow-float rounded-lg border p-4",
                STYLES[toast.variant],
              )}
            >
              <div className="flex gap-3">
                <Icon
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    toast.variant === "error" && "text-red-400",
                    toast.variant === "success" && "text-emerald-400",
                    toast.variant === "info" && "text-primary",
                  )}
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {toast.description}
                    </p>
                  )}
                  {toast.action && (
                    <FastLink
                      href={toast.action.href}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      {toast.action.label} →
                    </FastLink>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-premium hover:bg-white/5 hover:text-foreground"
                  aria-label={t("toast.close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
