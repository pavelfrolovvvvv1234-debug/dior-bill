import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-cereller flex min-h-screen items-center justify-center text-sm text-[var(--auth-muted)]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
