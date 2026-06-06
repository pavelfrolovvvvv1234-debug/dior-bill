import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { getReferralCodeFromCookie } from "@/lib/referral";

export default async function RegisterPage() {
  const storedReferralCode = await getReferralCodeFromCookie();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">Loading…</div>
      }
    >
      <RegisterForm initialReferralCode={storedReferralCode ?? undefined} />
    </Suspense>
  );
}
