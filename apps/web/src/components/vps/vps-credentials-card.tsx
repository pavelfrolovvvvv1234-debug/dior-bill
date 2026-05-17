"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyField } from "./copy-field";
import type { VpsAccessInfo } from "@dior/backend";

type Props = {
  initial: VpsAccessInfo;
  osLabel: string;
};

export function VpsCredentialsCard({ initial, osLabel }: Props) {
  const [access, setAccess] = useState(initial);

  useEffect(() => {
    setAccess(initial);
  }, [initial]);

  const provisioning =
    access.serviceStatus === "PENDING" || access.serviceStatus === "PROVISIONING";

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Access credentials</CardTitle>
          </div>
          {access.rescueMode && <Badge variant="warning">Rescue mode</Badge>}
        </div>
        <CardDescription>
          Login for {osLabel}. Use these details to connect via SSH or RDP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {provisioning ? (
          <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-4 text-sm text-muted-foreground">
            Server is still being deployed. Username and password will appear here when
            provisioning completes.
          </p>
        ) : !access.host ? (
          <p className="text-sm text-muted-foreground">No IP assigned yet.</p>
        ) : (
          <>
            <CopyField label="Username (login)" value={access.username} />
            {access.password ? (
              <CopyField label="Password" value={access.password} masked />
            ) : (
              <p className="text-sm text-muted-foreground">
                Password not stored. Use <strong>Reset password</strong> in Actions to generate a
                new one.
              </p>
            )}
            <CopyField label="IP address" value={access.host} mono />
            {access.sshCommand && (
              <CopyField label="SSH command" value={access.sshCommand} mono />
            )}
            {access.rdpTarget && (
              <CopyField
                label="Remote Desktop (RDP)"
                value={`${access.rdpTarget}:3389`}
                mono
              />
            )}
            {access.proxmoxVmid && (
              <p className="text-xs text-muted-foreground">VM ID: {access.proxmoxVmid}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

