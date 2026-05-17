"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/store";
import {
  confirmTelegramLinkDevAction,
  createTelegramLinkAction,
  unlinkTelegramAction,
  updateTelegramNotificationsAction,
} from "@/app/actions/settings";
import type { SettingsProfile } from "./types";

export function IntegrationsSettings({ profile }: { profile: SettingsProfile }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState(profile.telegramNotifications);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [devUsername, setDevUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setErr(null);
    try {
      const res = await createTelegramLinkAction();
      setLinkToken(res.token);
      setDeepLink(res.deepLink);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmDevLink() {
    if (!linkToken) return;
    setLoading(true);
    try {
      await confirmTelegramLinkDevAction(linkToken, devUsername || undefined);
      setLinkToken(null);
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function unlink() {
    setLoading(true);
    try {
      await unlinkTelegramAction(password);
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function savePrefs(next: typeof prefs) {
    setPrefs(next);
    await updateTelegramNotificationsAction({
      billing: next.billing,
      abuse: next.abuse,
      serverStatus: next.serverStatus,
    });
  }

  return (
    <SettingsPanel title={t("settings.integrations.telegram")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          {profile.telegram ? (
            <>
              <p className="font-medium">
                @{profile.telegram.username ?? profile.telegram.id}
              </p>
              <Badge variant="success" className="mt-1">
                {t("settings.integrations.connected")}
              </Badge>
            </>
          ) : (
            <Badge variant="muted">{t("settings.integrations.notConnected")}</Badge>
          )}
        </div>
        {!profile.telegram && (
          <Button onClick={connect} disabled={loading}>
            {t("settings.integrations.connect")}
          </Button>
        )}
      </div>

      {deepLink && !profile.telegram && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Open the bot and send /start with your link token, or use the button below.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open Telegram bot
            </a>
          </Button>
          <div className="border-t border-white/6 pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Dev: simulate bot handshake</p>
            <Input
              placeholder="@username"
              value={devUsername}
              onChange={(e) => setDevUsername(e.target.value)}
            />
            <Button size="sm" onClick={confirmDevLink} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm link"}
            </Button>
          </div>
        </div>
      )}

      {profile.telegram && (
        <>
          <div className="mt-6 space-y-4 border-t border-white/6 pt-6">
            {(
              [
                ["billing", t("settings.integrations.billingAlerts")],
                ["abuse", t("settings.integrations.abuseAlerts")],
                ["serverStatus", t("settings.integrations.statusAlerts")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={prefs[key]}
                  onCheckedChange={(checked) =>
                    savePrefs({ ...prefs, [key]: checked })
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-6 max-w-sm space-y-2">
            <Input
              type="password"
              placeholder={t("settings.account.currentPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="destructive" onClick={unlink} disabled={!password || loading}>
              {t("settings.integrations.unlink")}
            </Button>
          </div>
        </>
      )}

      {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
    </SettingsPanel>
  );
}
