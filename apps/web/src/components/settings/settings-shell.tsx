"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { FastLink } from "@/components/ui/fast-link";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV, isSettingsSectionActive } from "@/lib/settings-nav";
import { useI18n, syncLocaleFromProfile } from "@/lib/i18n/store";
import { isLocaleId } from "@/lib/i18n";
import { SettingsLogout } from "@/components/settings/settings-logout";

export function SettingsShell({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (initialLocale && isLocaleId(initialLocale)) {
      syncLocaleFromProfile(initialLocale);
    }
  }, [initialLocale]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: t("settings.title") },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1 lg:sticky lg:top-20 lg:self-start">
          {SETTINGS_NAV.map((item) => {
            const active = isSettingsSectionActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <FastLink
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-premium",
                  active
                    ? "border-primary/30 bg-primary/5 shadow-[0_0_24px_rgba(59,130,246,0.08)]"
                    : "border-transparent hover:border-white/6 hover:bg-white/[0.03]",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                  {t(item.labelKey)}
                </span>
                <span className="pl-6 text-[11px] text-muted-foreground">{t(item.descriptionKey)}</span>
              </FastLink>
            );
          })}
          <SettingsLogout />
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
