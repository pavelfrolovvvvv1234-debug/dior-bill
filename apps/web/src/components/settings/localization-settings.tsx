"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import { useI18n } from "@/lib/i18n/store";
import { LOCALES, type LocaleId } from "@/lib/i18n";
import { updateLocaleAction } from "@/app/actions/settings";
import { cn } from "@/lib/utils";

export function LocalizationSettings({ initialLocale }: { initialLocale: string }) {
  const { locale, setLocale, t } = useI18n();
  const [active, setActive] = useState<LocaleId>(
    (LOCALES.find((l) => l.id === initialLocale)?.id ?? locale) as LocaleId,
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function select(id: LocaleId) {
    setActive(id);
    setLocale(id);
    setSaving(id);
    await updateLocaleAction(id);
    setSaving(null);
  }

  return (
    <SettingsPanel
      title={t("settings.localization.language")}
      description={t("settings.localization.languageHint")}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => select(l.id)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-premium",
              active === l.id
                ? "border-primary/35 bg-primary/5"
                : "border-white/6 hover:border-white/10 hover:bg-white/[0.03]",
            )}
          >
            <span>
              <span className="block text-sm font-medium">{l.native}</span>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </span>
            {active === l.id && (
              <Check className="h-4 w-4 text-primary" strokeWidth={2} />
            )}
            {saving === l.id && (
              <span className="text-[10px] text-muted-foreground">…</span>
            )}
          </button>
        ))}
      </div>
    </SettingsPanel>
  );
}
