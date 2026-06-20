import { prisma } from "@dior/database";
import { getProxmoxClient } from "../../proxmox/client";
import { markProvisioningFailed } from "../provisioning/engine";
import { reportOperationalIssue } from "../../lib/operational-alerts";

export async function reconcileProvisioningWithProxmox(): Promise<{
  fixed: number;
  findings: string[];
}> {
  const findings: string[] = [];
  let fixed = 0;

  const client = getProxmoxClient();
  if (!client) {
    return { fixed: 0, findings: ["Proxmox not configured — skipped VM sync"] };
  }

  const stuckProvisioning = await prisma.service.findMany({
    where: { status: "PROVISIONING" },
    include: { vpsInstance: { include: { node: true } }, provisioningJobs: true },
    take: 50,
  });

  for (const svc of stuckProvisioning) {
    const vps = svc.vpsInstance;
    const job = svc.provisioningJobs[0];
    if (!vps?.proxmoxVmid || !vps.node?.proxmoxNode) {
      const age = Date.now() - svc.updatedAt.getTime();
      if (age > 30 * 60 * 1000) {
        findings.push(`Service ${svc.id} stuck provisioning >30m without VMID`);
        if (job) {
          await markProvisioningFailed({
            serviceId: svc.id,
            idempotencyKey: `reconcile:fail:${svc.id}`,
            error: "Provisioning timeout — no VM created within 30 minutes",
            rollback: true,
          });
          await reportOperationalIssue({
            category: "provisioning.timeout",
            message: `VPS stuck in PROVISIONING >30m without VMID`,
            severity: "critical",
            serviceId: svc.id,
            userId: svc.userId,
            dedupeKey: `prov_timeout:${svc.id}`,
          });
          fixed++;
        }
      }
      continue;
    }

    try {
      const status = await client.getVmStatus(vps.node.proxmoxNode, vps.proxmoxVmid);
      if (status.status === "running" && svc.status === "PROVISIONING") {
        findings.push(`Service ${svc.id} VM running but still PROVISIONING — needs completion event`);
      }
    } catch {
      findings.push(`VM ${vps.proxmoxVmid} not found on Proxmox for service ${svc.id}`);
    }
  }

  const ghostVps = await prisma.vpsInstance.findMany({
    where: {
      proxmoxVmid: { not: null },
      service: { status: { in: ["FAILED", "DELETED", "CANCELLED"] } },
    },
    take: 20,
  });

  for (const v of ghostVps) {
    findings.push(`Ghost VM ${v.proxmoxVmid} for deleted/failed service ${v.serviceId}`);
  }

  return { fixed, findings };
}
