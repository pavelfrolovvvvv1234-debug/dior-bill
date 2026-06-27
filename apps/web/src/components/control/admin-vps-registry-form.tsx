"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminRegisterVpsInRegistryAction } from "@/app/actions/control";

export function AdminVpsRegistryForm({
  vmid,
  ip,
  hostname,
  externalServiceId,
}: {
  vmid: number;
  ip: string;
  hostname: string;
  externalServiceId?: string | null;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState<"telegram_bot" | "billing" | "manual">("telegram_bot");
  const [extId, setExtId] = useState(externalServiceId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await adminRegisterVpsInRegistryAction({
        vmid,
        ip,
        owner,
        hostname,
        externalServiceId: extId.trim() || undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <p className="text-xs text-[var(--muted-foreground)]">
        Register this VM in shared IP registry (used by billing + Telegram bot).
      </p>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted-foreground)]">Owner</span>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value as typeof owner)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="telegram_bot">Telegram bot</option>
          <option value="billing">Billing</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted-foreground)]">External service ID (bot)</span>
        <input
          value={extId}
          onChange={(e) => setExtId(e.target.value)}
          placeholder="Bot server id"
          className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Register in IP registry"}
      </Button>
    </form>
  );
}
