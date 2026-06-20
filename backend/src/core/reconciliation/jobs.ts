import { prisma } from "@dior/database";
import { toJsonValue } from "../../lib/json";
import { reconcileBillingServices } from "../billing/engine";
import { resumeAllStuckVpsProvisioning } from "../provisioning/engine";
import { syncNodeCapacityFromDb } from "../inventory/service";
import { reconcileProvisioningWithProxmox } from "./proxmox-sync";

export type ReconciliationDomain =
  | "billing_service"
  | "inventory_capacity"
  | "provisioning_proxmox"
  | "ip_allocation";

export async function runReconciliation(
  domain: ReconciliationDomain,
): Promise<{ fixesApplied: number; findings: string[] }> {
  const run = await prisma.reconciliationRun.create({
    data: { domain, status: "running" },
  });

  try {
    let fixesApplied = 0;
    let findings: string[] = [];

    switch (domain) {
      case "billing_service": {
        const r = await reconcileBillingServices();
        fixesApplied = r.fixed;
        findings = r.findings;
        const resume = await resumeAllStuckVpsProvisioning();
        if (resume.findings.length) {
          findings = [...findings, ...resume.findings];
        }
        fixesApplied += resume.usersProcessed;
        break;
      }
      case "inventory_capacity": {
        fixesApplied = await syncNodeCapacityFromDb();
        findings = [`Synced ${fixesApplied} nodes`];
        break;
      }
      case "provisioning_proxmox": {
        const r = await reconcileProvisioningWithProxmox();
        fixesApplied = r.fixed;
        findings = r.findings;
        break;
      }
      case "ip_allocation": {
        const r = await reconcileIpAllocation();
        fixesApplied = r.fixed;
        findings = r.findings;
        break;
      }
    }

    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        fixesApplied,
        findings: toJsonValue({ items: findings }),
        completedAt: new Date(),
      },
    });

    return { fixesApplied, findings };
  } catch (err) {
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        findings: toJsonValue({
          error: err instanceof Error ? err.message : "Unknown",
        }),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

async function reconcileIpAllocation(): Promise<{ fixed: number; findings: string[] }> {
  const findings: string[] = [];
  let fixed = 0;

  const orphaned = await prisma.ipAddress.findMany({
    where: { status: "assigned", vpsId: { not: null } },
  });

  for (const ip of orphaned) {
    if (!ip.vpsId) continue;
    const vps = await prisma.vpsInstance.findUnique({ where: { id: ip.vpsId } });
    if (!vps?.primaryIp || vps.primaryIp !== ip.address) {
      findings.push(`IP ${ip.address} assigned to missing/mismatched VPS ${ip.vpsId}`);
      await prisma.ipAddress.update({
        where: { id: ip.id },
        data: { status: "available", vpsId: null },
      });
      fixed++;
    }
  }

  return { fixed, findings };
}

export async function runAllReconciliations(): Promise<void> {
  const domains: ReconciliationDomain[] = [
    "billing_service",
    "inventory_capacity",
    "provisioning_proxmox",
    "ip_allocation",
  ];
  for (const d of domains) {
    await runReconciliation(d);
  }
}
