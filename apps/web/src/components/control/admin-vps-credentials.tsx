"use client";

import { CopyField } from "@/components/vps/copy-field";
import { Panel } from "@/components/control/panel";
import { Badge } from "@/components/ui/badge";

type AccessProps = {
  username: string;
  password: string | null;
  host: string | null;
  sshCommand: string | null;
  rdpTarget: string | null;
  proxmoxVmid: number | null;
  osLabel?: string | null;
  passwordSource?: string | null;
  warnings?: string[];
};

export function AdminVpsCredentialsPanel({
  username,
  password,
  host,
  sshCommand,
  rdpTarget,
  proxmoxVmid,
  osLabel,
  passwordSource,
  warnings = [],
}: AccessProps) {
  return (
    <Panel title="Access credentials" description="Login details for SSH / RDP (admin only)">
      <div className="space-y-4 p-4 pt-0">
        {warnings.length > 0 && (
          <ul className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {osLabel && (
          <p className="text-xs text-[var(--muted-foreground)]">OS: {osLabel}</p>
        )}
        <CopyField label="Username (login)" value={username} />
        {password ? (
          <CopyField label="Password" value={password} masked />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Password not available in billing or Telegram bot DB.
          </p>
        )}
        {passwordSource && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Source: {passwordSource === "billing" ? "Web billing" : "Telegram bot DB"}
          </p>
        )}
        {host && <CopyField label="IP address" value={host} mono />}
        {sshCommand && <CopyField label="SSH command" value={sshCommand} mono />}
        {rdpTarget && (
          <CopyField label="Remote Desktop (RDP)" value={`${rdpTarget}:3389`} mono />
        )}
        {proxmoxVmid != null && (
          <p className="text-xs text-[var(--muted-foreground)]">Proxmox VMID: {proxmoxVmid}</p>
        )}
      </div>
    </Panel>
  );
}

export function AdminVpsSourceBadge({ source }: { source: string }) {
  const label =
    source === "billing"
      ? "Billing"
      : source === "telegram_bot"
        ? "Telegram bot"
        : source === "manual"
          ? "Manual / sync"
          : "Proxmox only";

  const variant =
    source === "billing"
      ? "default"
      : source === "telegram_bot"
        ? "secondary"
        : "outline";

  return <Badge variant={variant as "default" | "secondary" | "outline"}>{label}</Badge>;
}
