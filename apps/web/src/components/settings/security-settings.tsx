"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/store";
import {
  beginTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
} from "@/app/actions/settings";
import type { SettingsProfile } from "./types";

export function SecuritySettings({ profile }: { profile: SettingsProfile }) {
  const { t } = useI18n();
  const [step, setStep] = useState<"idle" | "setup" | "codes">("idle");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qrUrl = otpauth
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`
    : "";

  async function startSetup() {
    setLoading(true);
    setErr(null);
    try {
      const res = await beginTwoFactorSetupAction();
      setOtpauth(res.otpauth);
      setStep("setup");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup() {
    setLoading(true);
    setErr(null);
    try {
      const res = await confirmTwoFactorSetupAction(code);
      setRecoveryCodes(res.recoveryCodes);
      setStep("codes");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      await disableTwoFactorAction(password, code || undefined);
      setStep("idle");
      setPassword("");
      setCode("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setLoading(true);
    try {
      const res = await regenerateRecoveryCodesAction(password);
      setRecoveryCodes(res.recoveryCodes);
      setStep("codes");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsPanel
      title={t("settings.security.twoFactorTitle")}
      description={t("settings.security.confirmReauth")}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
        <Badge variant={profile.twoFactorEnabled ? "success" : "muted"}>
          {profile.twoFactorEnabled
            ? t("settings.security.twoFactorOn")
            : t("settings.security.twoFactorOff")}
        </Badge>
        {profile.twoFactorEnabled && (
          <span className="text-xs text-muted-foreground">
            {profile.recoveryCodesRemaining} recovery codes left
          </span>
        )}
      </div>

      {!profile.twoFactorEnabled && step === "idle" && (
        <Button className="mt-4" onClick={startSetup} disabled={loading}>
          {t("settings.security.enable2fa")}
        </Button>
      )}

      {step === "setup" && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("settings.security.step1")}
            </p>
            {qrUrl && (
              <div className="inline-block rounded-lg border border-white/8 bg-white p-2">
                <img src={qrUrl} alt="2FA QR" width={200} height={200} className="block" />
              </div>
            )}
          </div>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("settings.security.step2")}
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="max-w-[200px] font-mono text-lg tracking-[0.3em]"
            />
            <Button className="mt-4" onClick={confirmSetup} disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.common.confirm")}
            </Button>
          </div>
        </div>
      )}

      {step === "codes" && recoveryCodes.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">{t("settings.security.recoveryCodes")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
            {recoveryCodes.map((c) => (
              <span key={c} className="rounded bg-black/30 px-2 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.twoFactorEnabled && (
        <div className="mt-6 max-w-md space-y-3 border-t border-white/6 pt-6">
          <Input
            type="password"
            placeholder={t("settings.account.currentPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="2FA or recovery code"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={disable} disabled={loading || !password}>
              {t("settings.security.disable2fa")}
            </Button>
            <Button variant="outline" onClick={regenerate} disabled={loading || !password}>
              {t("settings.security.regenerateCodes")}
            </Button>
          </div>
        </div>
      )}

      {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
    </SettingsPanel>
  );
}
