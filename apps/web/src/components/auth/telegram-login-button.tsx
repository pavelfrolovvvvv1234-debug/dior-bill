"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { telegramLoginAction } from "@/app/actions/auth";
import { useAuthStore } from "@/stores/auth-store";
import { isStaffRole } from "@/lib/staff";
import { cn } from "@/lib/utils";

export type TelegramWidgetUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

type TelegramLoginButtonProps = {
  referralCode?: string;
  className?: string;
  onError?: (message: string) => void;
};

/**
 * Official Telegram Login Widget (https://core.telegram.org/widgets/login).
 * Requires NEXT_PUBLIC_TELEGRAM_BOT_USERNAME and TELEGRAM_BOT_TOKEN on the server.
 */
export function TelegramLoginButton({ referralCode, className, onError }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const container = containerRef.current;

    window.onTelegramAuth = async (user: TelegramWidgetUser) => {
      setLoading(true);
      try {
        const result = await telegramLoginAction(user, referralCode);
        setUser(result.user);
        router.push(isStaffRole(result.user.role) ? "/control" : "/dashboard");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Telegram sign-in failed";
        onError?.(message);
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.innerHTML = "";
    };
  }, [botUsername, referralCode, onError, router, setUser]);

  if (!botUsername) {
    if (process.env.NODE_ENV === "development") {
      return (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
          Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME and TELEGRAM_BOT_TOKEN to enable Telegram login.
        </p>
      );
    }
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 text-sm text-muted-foreground">
          Signing in…
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "flex min-h-[44px] justify-center [&_iframe]:max-w-full",
          loading && "pointer-events-none opacity-60",
        )}
      />
    </div>
  );
}
