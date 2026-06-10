"use client";

import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    __cfTurnstileOnLoad?: () => void;
  }
}

type TurnstileFieldProps = {
  siteKey: string;
  onToken: (token: string | null) => void;
};

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_BASE = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function waitForTurnstile(onReady: () => void, timeoutMs = 10_000) {
  if (window.turnstile) {
    onReady();
    return () => undefined;
  }

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (window.turnstile) {
      window.clearInterval(timer);
      onReady();
      return;
    }
    if (Date.now() - started >= timeoutMs) {
      window.clearInterval(timer);
    }
  }, 40);

  return () => window.clearInterval(timer);
}

function loadTurnstileScript(onLoad: () => void) {
  if (window.turnstile) {
    onLoad();
    return () => undefined;
  }

  window.__cfTurnstileOnLoad = onLoad;

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return waitForTurnstile(onLoad);
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `${SCRIPT_BASE}?render=explicit&onload=__cfTurnstileOnLoad`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  return waitForTurnstile(onLoad);
}

export function TurnstileField({ siteKey, onToken }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      size: "flexible",
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return;

    const stopWaiting = loadTurnstileScript(renderWidget);

    return () => {
      stopWaiting?.();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget]);

  return (
    <div
      ref={containerRef}
      className="cf-turnstile-host w-full min-h-[65px] overflow-hidden rounded-md border border-white/8 bg-white/[0.02]"
      aria-label="Captcha verification"
    />
  );
}
