"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@dior/shared";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/lib/i18n/store";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="email" type="email" placeholder={t("auth.email")} autoComplete="email" required />
              <Input
                name="password"
                type="password"
                placeholder={t("auth.password")}
                autoComplete="new-password"
                required
                minLength={8}
              />
              <Input
                name="referralCode"
                placeholder="Referral code (optional)"
                defaultValue={params.get("ref") ?? ""}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.creating") : t("auth.createAccount")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                {t("auth.signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
