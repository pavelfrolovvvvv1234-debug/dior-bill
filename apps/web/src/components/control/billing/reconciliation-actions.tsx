"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { triggerReconciliationAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

const DOMAINS = [
  { id: "billing_service" as const, label: "Billing services", desc: "Invoice/subscription drift" },
  { id: "inventory_capacity" as const, label: "Node capacity", desc: "Sync VPS node counters" },
  { id: "provisioning_proxmox" as const, label: "Proxmox sync", desc: "VM state reconciliation" },
  { id: "ip_allocation" as const, label: "IP allocation", desc: "Orphaned IP cleanup" },
];

export function ReconciliationActions() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DOMAINS.map((domain) => (
        <div key={domain.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="font-medium">{domain.label}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{domain.desc}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3 gap-1.5"
            disabled={!!pending}
            onClick={() =>
              start(async () => {
                await triggerReconciliationAction(domain.id);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run now
          </Button>
        </div>
      ))}
    </div>
  );
}
