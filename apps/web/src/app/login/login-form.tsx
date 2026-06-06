"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, normalizeReferralCode } from "@dior/shared";
import { useAuthStore } from "@/stores/auth-store";
import { isStaffRole } from "@/lib/staff";
import { useI18n } from "@/lib/i18n/store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const setUser = useAuthStore((s) => s.setUser);
  const referralCode = normalizeReferralCode(searchParams.get("ref"));
  const registerHref = referralCode
    ? `/register?ref=${encodeURIComponent(referralCode)}`
    : "/register";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await loginAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUser(result.user);
      router.push(isStaffRole(result.user.role) ? "/control" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
        </div>

        <Card className="auth-card shadow-none">
          <CardHeader>
            <CardTitle>{t("auth.signIn")}</CardTitle>
            <CardDescription>{t("auth.signInDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("auth.email")}
                </label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("auth.password")}
                </label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.signingIn") : t("common.continue")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link href={registerHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                {t("auth.register")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
