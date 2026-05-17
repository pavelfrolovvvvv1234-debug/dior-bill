"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";

export function SettingsLogout() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logoutAction();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-4">
      <p className="text-sm font-medium">{t("settings.logout.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("settings.logout.hint")}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full gap-2 border-white/10 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={loading}
        onClick={handleLogout}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        )}
        {t("settings.logout.button")}
      </Button>
    </div>
  );
}
