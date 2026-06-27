import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { createInvoiceInEngine } from "../core/billing/invoice-engine";
import { encodeInvoiceBillingAction } from "../billing/invoice-actions";
import { getProxmoxClient, getProxmoxNodeName, isProxmoxConfigured } from "../proxmox";

export type VpsUpgradePlan = {
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  monthlyPrice: number;
  planLabel?: string;
};

function isStrictUpgrade(
  current: { cpuCores: number; ramMb: number; diskGb: number; monthlyPrice: number },
  target: VpsUpgradePlan,
): boolean {
  const betterSpecs =
    target.cpuCores > current.cpuCores ||
    target.ramMb > current.ramMb ||
    target.diskGb > current.diskGb;
  return betterSpecs && target.monthlyPrice > current.monthlyPrice;
}

export async function createVpsUpgradeInvoice(params: {
  userId: string;
  vpsId: string;
  plan: VpsUpgradePlan;
}) {
  const vps = await prisma.vpsInstance.findFirst({
    where: { id: params.vpsId, service: { userId: params.userId } },
    include: { service: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");
  if (vps.service.status !== "ACTIVE") {
    throw new ValidationError("Only active VPS instances can be upgraded");
  }

  const current = {
    cpuCores: vps.cpuCores,
    ramMb: vps.ramMb,
    diskGb: vps.diskGb,
    monthlyPrice: Number(vps.service.monthlyPrice),
  };

  if (!isStrictUpgrade(current, params.plan)) {
    throw new ValidationError("Selected plan must be higher than your current configuration");
  }

  const openUpgrade = await prisma.invoice.findFirst({
    where: {
      userId: params.userId,
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      notes: { contains: `"vpsId":"${params.vpsId}"` },
    },
    orderBy: { createdAt: "desc" },
  });
  if (openUpgrade) {
    return { invoiceId: openUpgrade.id, existing: true as const };
  }

  const delta = Math.round((params.plan.monthlyPrice - current.monthlyPrice) * 100) / 100;
  if (delta <= 0) {
    throw new ValidationError("Upgrade price must be higher than your current plan");
  }
  const label = params.plan.planLabel ?? `${params.plan.cpuCores} vCPU · ${params.plan.ramMb / 1024} GB · ${params.plan.diskGb} GB`;

  const invoice = await createInvoiceInEngine({
    userId: params.userId,
    items: [
      {
        description: `Upgrade: ${vps.hostname} → ${label}`,
        unitPrice: delta,
        serviceId: vps.serviceId,
      },
    ],
    notes: encodeInvoiceBillingAction({
      type: "upgrade",
      vpsId: vps.id,
      cpuCores: params.plan.cpuCores,
      ramMb: params.plan.ramMb,
      diskGb: params.plan.diskGb,
      monthlyPrice: params.plan.monthlyPrice,
      planLabel: params.plan.planLabel,
    }),
    dueInDays: 7,
    idempotencyKey: `user-upgrade:${vps.id}:${params.plan.cpuCores}:${params.plan.ramMb}:${params.plan.diskGb}`,
  });

  return { invoiceId: invoice.id, existing: false as const };
}

export async function applyVpsUpgradeAfterPayment(params: {
  userId: string;
  vpsId: string;
  plan: VpsUpgradePlan;
  invoiceId: string;
  idempotencyKey: string;
}): Promise<void> {
  const vps = await prisma.vpsInstance.findFirst({
    where: { id: params.vpsId, service: { userId: params.userId } },
    include: { service: true, node: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");
  if (vps.service.status !== "ACTIVE") {
    throw new ValidationError("VPS must be active to apply upgrade");
  }

  const current = {
    cpuCores: vps.cpuCores,
    ramMb: vps.ramMb,
    diskGb: vps.diskGb,
    monthlyPrice: Number(vps.service.monthlyPrice),
  };
  if (!isStrictUpgrade(current, params.plan)) {
    throw new ValidationError("Upgrade plan is no longer valid for this VPS");
  }

  if (isProxmoxConfigured() && !vps.proxmoxVmid) {
    throw new ValidationError("VPS is not linked to Proxmox yet — finish provisioning first");
  }

  await prisma.$transaction([
    prisma.vpsInstance.update({
      where: { id: vps.id },
      data: {
        cpuCores: params.plan.cpuCores,
        ramMb: params.plan.ramMb,
        diskGb: params.plan.diskGb,
      },
    }),
    prisma.service.update({
      where: { id: vps.serviceId },
      data: { monthlyPrice: params.plan.monthlyPrice },
    }),
  ]);

  const client = getProxmoxClient();
  if (client && vps.proxmoxVmid) {
    const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
    const config = (await import("../proxmox/config")).getProxmoxConfig();
    try {
      await client.configureVm({
        vmid: vps.proxmoxVmid,
        node,
        hostname: vps.hostname,
        cores: params.plan.cpuCores,
        memoryMb: params.plan.ramMb,
        diskGb: params.plan.diskGb,
        templateVmid: 0,
        storage: config?.storage ?? "local-lvm",
        bridge: config?.bridge ?? "vmbr0",
        primaryIp: vps.primaryIp ?? undefined,
      });
    } catch (err) {
      const { reportOperationalIssue } = await import("../lib/operational-alerts");
      await reportOperationalIssue({
        category: "vps.upgrade.proxmox",
        message: err instanceof Error ? err.message : "Proxmox resize failed after paid upgrade",
        severity: "critical",
        serviceId: vps.serviceId,
        userId: params.userId,
        details: { vpsId: vps.id, vmid: vps.proxmoxVmid },
        dedupeKey: `upgrade_proxmox:${params.invoiceId}`,
      });
    }
  }

  const { appendDomainEvent } = await import("../core/events/store");
  const { DOMAIN_EVENTS } = await import("@dior/shared");
  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.SERVICE_PROVISIONED,
    aggregateType: "service",
    aggregateId: vps.serviceId,
    userId: params.userId,
    payload: {
      action: "upgraded",
      vpsId: vps.id,
      plan: params.plan,
      invoiceId: params.invoiceId,
    },
    idempotencyKey: params.idempotencyKey,
  });
}
