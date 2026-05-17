"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VpsCredentialsCard } from "@/components/vps/vps-credentials-card";
import { VpsActions } from "./vps-actions";
import type { VpsAccessInfo } from "@dior/backend";

export function VpsDetailPanel({
  vpsId,
  access,
  osLabel,
  actionsDisabled,
}: {
  vpsId: string;
  access: VpsAccessInfo;
  osLabel: string;
  actionsDisabled: boolean;
}) {
  const router = useRouter();
  const [credKey, setCredKey] = useState(0);

  return (
    <div className="space-y-6">
    <VpsCredentialsCard key={credKey} initial={access} osLabel={osLabel} />
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Power & maintenance
      </p>
    <VpsActions
      vpsId={vpsId}
      disabled={actionsDisabled}
      onPasswordReset={() => {
        setCredKey((k) => k + 1);
        router.refresh();
      }}
    />
    </div>
    </div>
  );
}
