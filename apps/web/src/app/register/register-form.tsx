"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  analyzePassword,
  APP_NAME,
  isValidRegistrationEmail,
  normalizeRegistrationEmail,
  normalizeReferralCode,
} from "@dior/shared";
import { registerAction } from "@/app/actions/auth";
import { PasswordStrengthField } from "@/components/auth/password-strength-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/lib/i18n/store";
import { readReferralCookieClient } from "@/lib/referral-client";
import { cn } from "@/lib/utils";

type RegisterFormProps = {
  initialReferralCode?: string;
};

export function RegisterForm({ initialReferralCode }: RegisterFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const emailError = useMemo(() => {
    if (!emailTouched) return null;
    const normalized = normalizeRegistrationEmail(email);
    if (!normalized) return t("auth.emailRequired");
    if (!isValidRegistrationEmail(normalized)) return t("auth.emailInvalid");
    return null;
  }, [email, emailTouched, t]);

  const passwordAnalysis = useMemo(() => analyzePassword(password), [password]);

  const ruleLabels = useMemo(
    () => ({
      length: t("auth.passwordRule.length"),
      lower: t("auth.passwordRule.lower"),
      upper: t("auth.passwordRule.upper"),
      number: t("auth.passwordRule.number"),
      special: t("auth.passwordRule.special"),
    }),
    [t],
  );

  const strengthLabels = useMemo(
    () => ({
      weak: t("auth.passwordStrength.weak"),
      fair: t("auth.passwordStrength.fair"),
      good: t("auth.passwordStrength.good"),
      strong: t("auth.passwordStrength.strong"),
    }),
    [t],
  );

  const loginHref = referralCode ? `/login?ref=${encodeURIComponent(referralCode)}` : "/login";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailTouched(true);
    setError(null);

    const normalized = normalizeRegistrationEmail(email);
    if (!normalized || !isValidRegistrationEmail(normalized)) {
      setError(t("auth.emailInvalid"));
      return;
    }
    if (!passwordAnalysis.strongEnough) {
      setError(t("auth.passwordTooWeak"));
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("email", normalized);
      if (referralCode) formData.set("referralCode", referralCode);
      const result = await registerAction(formData);
      setUser(result.user);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !loading &&
    isValidRegistrationEmail(normalizeRegistrationEmail(email)) &&
    passwordAnalysis.strongEnough;

  return (
    <div className="auth-page flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.createAccount")}</p>
        </div>
        <Card className="auth-card shadow-none">
          <CardHeader>
            <CardTitle>{t("auth.register")}</CardTitle>
            <CardDescription>{t("auth.registerDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {autoReferral && (
              <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                {t("auth.referralInvite")}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("auth.email")}
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  required
                  className={cn(emailError && "border-destructive focus-visible:ring-destructive/30")}
                  aria-invalid={emailError ? true : undefined}
                />
                {emailError && (
                  <p className="text-xs text-destructive auth-field-error-in">{emailError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("auth.password")}
                </label>
                <PasswordStrengthField
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.password")}
                  ruleLabels={ruleLabels}
                  strengthLabels={strengthLabels}
                  strengthTitle={t("auth.passwordStrengthTitle")}
                />
              </div>

              {referralCode ? (
                <input type="hidden" name="referralCode" value={referralCode} />
              ) : (
                <Input
                  name="referralCode"
                  placeholder={t("auth.referralCodeOptional")}
                />
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading ? t("auth.creating") : t("auth.createAccount")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link href={loginHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                {t("auth.signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
