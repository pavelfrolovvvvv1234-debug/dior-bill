"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TERMINAL = new Set(["ACTIVE", "FAILED", "DELETED", "CANCELLED", "EXPIRED"]);

/** Soft refresh while VPS is still provisioning — exponential backoff, stops on terminal status. */
export function VpsProvisioningRefresh({
  status,
  intervalMs = 5000,
}: {
  status: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAt = useRef(Date.now());
  const provisioning = !TERMINAL.has(status) &&
    (status === "PENDING" || status === "PROVISIONING" || status === "REINSTALLING");

  useEffect(() => {
    if (!provisioning) return;
    startedAt.current = Date.now();
    setElapsedSec(0);
    const tick = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [provisioning, status]);

  useEffect(() => {
    if (!provisioning) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = intervalMs;
    const maxDelay = 30_000;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        router.refresh();
        delay = Math.min(Math.round(delay * 1.35), maxDelay);
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [provisioning, intervalMs, router, status]);

  if (!provisioning) return null;

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const elapsedLabel =
    mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;

  return (
    <p className="rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-muted-foreground">
      Provisioning in progress ({elapsedLabel}) — this page updates automatically. Typical wait:
      2–10 minutes. Steps: order → create VPS → boot → IP → ready.
    </p>
  );
}
