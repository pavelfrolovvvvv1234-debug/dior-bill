"use client";

import { KeyRound } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/store";
import { useToastStore } from "@/lib/toast";

export function ApiSettings() {
  const { t } = useI18n();
  const pushToast = useToastStore((s) => s.push);

  function notifySoon() {
    pushToast({
      variant: "info",
      title: t("settings.api.soonToastTitle"),
      description: t("settings.api.soonToastDesc"),
    });
  }

  return (
    <SettingsPanel title={t("settings.api.keys")} description={t("settings.api.soonLead")}>
      <div className="flex flex-col items-center py-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
          <KeyRound className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <Badge className="mb-3 border-primary/35 bg-primary/15 text-primary">
          {t("settings.api.soonBadge")}
        </Badge>
        <p className="max-w-md text-sm text-muted-foreground">{t("settings.api.soonToastDesc")}</p>
        <Button type="button" className="mt-8 min-w-[200px]" onClick={notifySoon}>
          {t("settings.api.createKey")}
        </Button>
      </div>
    </SettingsPanel>
  );
}
