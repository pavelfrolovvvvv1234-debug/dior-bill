"use client";

import Link from "next/link";
import { DiorWordmark } from "@/components/brand/dior-wordmark";
import { useI18n } from "@/lib/i18n/store";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@dior.host";

type AuthShellProps = {
  mode: "login" | "register";
  alternateHref: string;
  children: React.ReactNode;
};

export function AuthShell({ mode, alternateHref, children }: AuthShellProps) {
  const { t } = useI18n();
  const title = mode === "login" ? t("auth.heroLogin") : t("auth.heroRegister");
  const subtitle = mode === "login" ? t("auth.heroLoginSub") : t("auth.heroRegisterSub");
  const switchPrompt = mode === "login" ? t("auth.noAccount") : t("auth.hasAccount");
  const switchLabel = mode === "login" ? t("auth.register") : t("auth.signInLink");

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
