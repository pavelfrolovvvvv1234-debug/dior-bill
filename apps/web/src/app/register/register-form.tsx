"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  analyzePassword,
  isValidRegistrationEmail,
  normalizeRegistrationEmail,
  normalizeReferralCode,
} from "@dior/shared";
import { registerAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { useAuthStore } from "@/stores/auth-store";
import { usePreloaderStore } from "@/stores/preloader-store";
import { useI18n } from "@/lib/i18n/store";
import { readReferralCookieClient } from "@/lib/referral-client";
import { cn } from "@/lib/utils";

type RegisterFormProps = {
  initialReferralCode?: string;
  turnstileSiteKey?: string;
};

export function RegisterForm({ initialReferralCode, turnstileSiteKey }: RegisterFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const setUser = useAuthStore((s) => s.setUser);
  const showPreloader = usePreloaderStore((s) => s.show);
  const finishAuthTransition = usePreloaderStore((s) => s.finishAuthTransition);
  const cancelPreloader = usePreloaderStore((s) => s.cancel);
  const authInFlight = useRef(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const captchaRequired = !!turnstileSiteKey;

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileKey((k) => k + 1);
  }

  function validateEmailField(value: string) {
    const normalized = normalizeRegistrationEmail(value);
    if (!normalized) return t("auth.emailRequired");
    if (!isValidRegistrationEmail(normalized)) return t("auth.emailInvalid");
    return null;
  }

  const referralCode = useMemo(() => {
    const fromUrl = normalizeReferralCode(params.get("ref"));
    const fromServer = normalizeReferralCode(initialReferralCode);
    const fromCookie = readReferralCookieClient();
    return fromUrl ?? fromServer ?? fromCookie ?? "";
  }, [params, initialReferralCode]);

  const autoReferral = useMemo(() => {
    const fromUrl = normalizeReferralCode(params.get("ref"));
    const fromServer = normalizeReferralCode(initialReferralCode);
    const fromCookie = readReferralCookieClient();
    return !!(fromUrl ?? fromServer ?? fromCookie);
  }, [params, initialReferralCode]);

  const loginHref = referralCode ? `/login?ref=${encodeURIComponent(referralCode)}` : "/login";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authInFlight.current) return;
    setError(null);

    const formData = new FormData(e.currentTarget);
    const emailRaw = String(formData.get("email") ?? "");
    const passwordRaw = String(formData.get("password") ?? "");
    const nextEmailError = validateEmailField(emailRaw);
    setEmailError(nextEmailError);

    const normalized = normalizeRegistrationEmail(emailRaw);
    if (!normalized || !isValidRegistrationEmail(normalized)) {
      setError(t("auth.emailInvalid"));
      return;
    }
    if (!analyzePassword(passwordRaw).strongEnough) {
      setError(t("auth.passwordTooWeak"));
      return;
    }
    if (captchaRequired && !turnstileToken) {
      setError(t("auth.captchaRequired"));
      return;
    }

    authInFlight.current = true;
    setLoading(true);
    const startedAt = Date.now();
    showPreloader();

    try {
      formData.set("email", normalized);
      if (referralCode) formData.set("referralCode", referralCode);
      if (turnstileToken) formData.set("cf-turnstile-response", turnstileToken);
      const result = await registerAction(formData);
      if (!result.ok) {
        cancelPreloader();
        setError(result.error);
        resetTurnstile();
        return;
      }
      setUser(result.user);
      await finishAuthTransition(startedAt, () => router.push("/dashboard"));
      router.refresh();
    } catch (err) {
      cancelPreloader();
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
      resetTurnstile();
    } finally {
      authInFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell mode="register" alternateHref={loginHref}>
      {autoReferral && (
        <p className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--auth-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--auth-primary)_10%,transparent)] px-3 py-2 text-sm text-[var(--auth-primary)]">
          {t("auth.referralInvite")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
          onBlur={(e) => setEmailError(validateEmailField(e.target.value))}
          required
          className={cn("auth-cereller-input", emailError && "auth-cereller-input-error")}
          aria-invalid={emailError ? true : undefined}
        />
        {emailError && <p className="text-xs text-[var(--auth-danger)]">{emailError}</p>}

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          required
          className="auth-cereller-input"
        />

        {referralCode ? (
          <input type="hidden" name="referralCode" value={referralCode} />
        ) : (
          <input
            name="referralCode"
            placeholder={t("auth.referralCodeOptional")}
            className="auth-cereller-input"
          />
        )}

        {turnstileSiteKey && (
          <div className="pt-1">
            <TurnstileField
              key={turnstileKey}
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
            />
          </div>
        )}

        {error && <p className="text-sm text-[var(--auth-danger)]">{error}</p>}

        <button type="submit" className="auth-cereller-submit" disabled={loading}>
          {loading ? t("auth.creating") : t("auth.continue")}
        </button>
      </form>
    </AuthShell>
  );
}
