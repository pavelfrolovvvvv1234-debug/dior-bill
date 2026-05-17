import { Suspense } from "react";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">Loading…</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
