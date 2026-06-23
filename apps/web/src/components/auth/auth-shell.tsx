"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DiorWordmark } from "@/components/brand/dior-wordmark";
import { authT } from "@/lib/i18n/auth";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@dior.host";

type AuthShellProps = {
  mode: "login" | "register";
  alternateHref: string;
  children: React.ReactNode;
};

export function AuthShell({ mode, alternateHref, children }: AuthShellProps) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = "en";
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  const title = mode === "login" ? authT("auth.heroLogin") : authT("auth.heroRegister");
  const subtitle = mode === "login" ? authT("auth.heroLoginSub") : authT("auth.heroRegisterSub");
  const switchPrompt = mode === "login" ? authT("auth.noAccount") : authT("auth.hasAccount");
  const switchLabel = mode === "login" ? authT("auth.register") : authT("auth.signInLink");

  return (
    <div className="auth-cereller flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[920px]">
        <div className="auth-cereller-card overflow-hidden rounded-xl border">
          <div className="grid min-h-[min(520px,80vh)] md:grid-cols-2">
            <aside className="auth-cereller-aside flex flex-col border-b p-8 md:border-b-0 md:border-r md:p-10">
              <Link href="/" className="inline-flex w-fit">
                <DiorWordmark className="h-[21px] w-auto" />
              </Link>
              <div className="mt-auto pt-12">
                <h1 className="auth-cereller-title text-[2rem] font-semibold leading-tight tracking-tight md:text-[2.35rem]">
                  {title}
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--auth-muted)]">
                  {subtitle}
                </p>
              </div>
            </aside>

            <div className="flex flex-col justify-center p-8 md:p-10">
              {children}
              <p className="mt-6 text-center text-sm text-[var(--auth-muted)]">
                {switchPrompt}{" "}
                <Link
                  href={alternateHref}
                  className="text-[var(--auth-fg)] underline underline-offset-4 hover:text-[var(--auth-primary)]"
                >
                  {switchLabel}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-[var(--auth-muted)]">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hover:text-[var(--auth-fg)]"
          >
            {SUPPORT_EMAIL}
          </a>
        </footer>
      </div>
    </div>
  );
}
