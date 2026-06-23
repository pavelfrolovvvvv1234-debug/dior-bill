"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { normalizeReferralCode } from "@dior/shared";
import { useAuthStore } from "@/stores/auth-store";
import { usePreloaderStore } from "@/stores/preloader-store";
import { isStaffRole } from "@/lib/staff";
import { authT } from "@/lib/i18n/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const showPreloader = usePreloaderStore((s) => s.show);
  const finishAuthTransition = usePreloaderStore((s) => s.finishAuthTransition);
  const cancelPreloader = usePreloaderStore((s) => s.cancel);
  const authInFlight = useRef(false);
  const referralCode = normalizeReferralCode(searchParams.get("ref"));
  const registerHref = referralCode
    ? `/register?ref=${encodeURIComponent(referralCode)}`
    : "/register";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authInFlight.current) return;

    authInFlight.current = true;
    setLoading(true);
    setError(null);

    const startedAt = Date.now();
    showPreloader();

    try {
      const formData = new FormData(e.currentTarget);
      const result = await loginAction(formData);
      if (!result.ok) {
        cancelPreloader();
        setError(result.error);
        return;
      }

      setUser(result.user);
      const target = isStaffRole(result.user.role) ? "/control" : "/dashboard";
      await finishAuthTransition(startedAt, () => router.push(target));
      router.refresh();
    } catch (err) {
      cancelPreloader();
      setError(err instanceof Error ? err.message : authT("auth.loginFailed"));
    } finally {
      authInFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell mode="login" alternateHref={registerHref}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={authT("auth.emailPlaceholder")}
          className="auth-cereller-input"
        />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder={authT("auth.passwordPlaceholder")}
          className="auth-cereller-input"
        />
        {error && <p className="text-sm text-[var(--auth-danger)]">{error}</p>}
        <button type="submit" className="auth-cereller-submit" disabled={loading}>
          {loading ? authT("auth.signingIn") : authT("auth.continue")}
        </button>
      </form>
    </AuthShell>
  );
}

