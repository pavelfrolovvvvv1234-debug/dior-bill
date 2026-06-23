import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { getReferralCodeFromCookie } from "@/lib/referral";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export default async function RegisterPage() {
  const storedReferralCode = await getReferralCodeFromCookie();
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <Suspense
      fallback={
        <div className="auth-cereller flex min-h-screen items-center justify-center text-sm text-[var(--auth-muted)]">
          Loading…
        </div>
      }
    >
      <RegisterForm
        initialReferralCode={storedReferralCode ?? undefined}
        turnstileSiteKey={turnstileSiteKey ?? undefined}
      />
    </Suspense>
  );
}
