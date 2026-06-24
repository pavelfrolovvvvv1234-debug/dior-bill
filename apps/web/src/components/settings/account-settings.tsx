"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";
import { changePasswordAction, updateProfileAction } from "@/app/actions/settings";
import type { SettingsProfile } from "./types";

export function AccountSettings({ profile }: { profile: SettingsProfile }) {
  const { t } = useI18n();
  const [email, setEmail] = useState(profile.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveProfile() {
    setLoading(true);
    setErr(null);
    try {
      await updateProfileAction({ email });
      setMsg(t("settings.common.saved"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await changePasswordAction(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg(t("settings.common.saved"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SettingsPanel title={t("settings.account.profile")}>
        <div className="max-w-md space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settings.account.email")}
          </label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button className="mt-4" onClick={saveProfile} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.account.save")}
        </Button>
      </SettingsPanel>

      <SettingsPanel title={t("settings.account.password")}>
        <div className="grid max-w-md gap-4">
          <Input
            type="password"
            placeholder={t("settings.account.currentPassword")}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder={t("settings.account.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder={t("settings.account.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button onClick={savePassword} disabled={loading || !currentPassword}>
            {t("settings.account.updatePassword")}
          </Button>
        </div>
      </SettingsPanel>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </>
  );
}
