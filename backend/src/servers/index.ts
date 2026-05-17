import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { createAuditLog } from "../audit";
import { encrypt } from "../lib/crypto";
import { createServiceOrder, startProvisioning } from "../core/provisioning/engine";
import { selectNodeForProvisioning } from "../core/inventory/service";
import { createInvoice, payInvoiceFromBalance } from "../billing";
import { emitPaymentConfirmed } from "../core/billing/engine";
import { enqueueJob } from "../lib/queue";
import {
  isProxmoxConfigured,
  rebootVpsOnProxmox,
  reinstallVpsOnProxmox,
  startVpsOnProxmox,
  stopVpsOnProxmox,
} from "../proxmox";
import { createHash } from "crypto";
import { ensureBulletproofVpsLocations } from "./locations";

export async function getUserVpsInstances(userId: string) {
  return prisma.vpsInstance.findMany({
    where: { service: { userId } },
    include: {
      service: true,
      node: true,
      location: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVpsById(vpsId: string, userId: string) {
  const vps = await prisma.vpsInstance.findFirst({
    where: { id: vpsId, service: { userId } },
    include: { service: true, node: true, location: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");
  return vps;
}

export async function refreshVpsLiveMetrics(vpsId: string, userId: string): Promise<void> {
  const vps = await getVpsById(vpsId, userId);
  if (vps.service.status !== "ACTIVE" || !vps.proxmoxVmid) return;
  const { syncVpsMetricsFromProxmox, isProxmoxConfigured } = await import("../proxmox");
  if (!isProxmoxConfigured()) return;
  try {
    await syncVpsMetricsFromProxmox(vpsId);
  } catch {
    /* non-fatal */
  }
}

export { getVpsAccessInfo, formatVpsOsLabel, resolveVpsLoginUser } from "./vps-access";
export type { VpsAccessInfo } from "./vps-access";

/**
 * Order VPS — billing decoupled. Provisioning starts ONLY after payment.confirmed event.
 */
export async function provisionVps(params: {
  userId: string;
  hostname: string;
  locationId: string;
  plan: { cpuCores: number; ramMb: number; diskGb: number; bandwidthTb: number; price: number };
  os?: string;
  idempotencyKey?: string;
  /** Dev/demo: skip invoice gate and provision immediately */
  prepaid?: boolean;
}) {
  await ensureBulletproofVpsLocations();

  const location = await prisma.location.findUnique({ where: { id: params.locationId } });
  if (!location?.active) throw new ValidationError("Location unavailable");

  const idempotencyKey =
    params.idempotencyKey ??
    createHash("sha256")
      .update(`${params.userId}:${params.hostname}:${Date.now()}`)
      .digest("hex")
      .slice(0, 32);

  const node = await selectNodeForProvisioning(params.locationId);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "VPS",
    label: params.hostname,
    monthlyPrice: params.plan.price,
    idempotencyKey,
    metadata: { locationId: params.locationId, os: params.os },
  });

  const vps = await prisma.vpsInstance.create({
    data: {
      serviceId,
      nodeId: node.id,
      locationId: params.locationId,
      hostname: params.hostname,
      os: params.os ?? "debian-12",
      cpuCores: params.plan.cpuCores,
      ramMb: params.plan.ramMb,
      diskGb: params.plan.diskGb,
      bandwidthTb: params.plan.bandwidthTb,
    },
  });

  const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const { updateServiceRenewalDates } = await import("../core/provisioning/engine");
  await updateServiceRenewalDates({
    serviceId,
    renewsAt,
    expiresAt: renewsAt,
    idempotencyKey: `vps:dates:${idempotencyKey}`,
  });
  const { createSubscription } = await import("../core/billing/subscriptions");
  await createSubscription({
    serviceId,
    nextRenewAt: renewsAt,
    idempotencyKey: `vps:sub:${idempotencyKey}`,
  });

  const invoice = await createInvoice({
    userId: params.userId,
    items: [
      {
        description: `VPS: ${params.hostname}`,
        unitPrice: params.plan.price,
        serviceId,
      },
    ],
  });

  if (params.prepaid || process.env.BILLING_AUTO_PROVISION === "true") {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (user && Number(user.balance) >= params.plan.price) {
      await payInvoiceFromBalance(invoice.id, params.userId);
    } else if (params.prepaid) {
      await emitPaymentConfirmed({
        userId: params.userId,
        invoiceId: invoice.id,
        amount: params.plan.price,
        idempotencyKey: `prepaid:${idempotencyKey}`,
      });
    }
  }

  return { serviceId, vps, invoice };
}

export async function vpsAction(
  vpsId: string,
  userId: string,
  action: "reboot" | "reinstall" | "rescue" | "reset_password" | "start" | "stop",
  options?: { os?: string },
) {
  const vps = await getVpsById(vpsId, userId);

  await createAuditLog({
    actorId: userId,
    action: `vps.${action}`,
    entityType: "vps",
    entityId: vpsId,
  });

  switch (action) {
    case "reboot":
      if (isProxmoxConfigured() && vps.proxmoxVmid) {
        await rebootVpsOnProxmox(vpsId, userId);
      } else {
        await enqueueJob("vps.reboot", { vpsId, proxmoxVmid: vps.proxmoxVmid });
      }
      break;
    case "start":
      if (!isProxmoxConfigured()) {
        throw new ValidationError("Proxmox is not configured on the server");
      }
      if (!vps.proxmoxVmid) {
        throw new ValidationError("VPS is not linked to Proxmox yet (wait for provisioning)");
      }
      await startVpsOnProxmox(vpsId, userId);
      break;
    case "stop":
      if (!isProxmoxConfigured()) {
        throw new ValidationError("Proxmox is not configured on the server");
      }
      if (!vps.proxmoxVmid) {
        throw new ValidationError("VPS is not linked to Proxmox yet (wait for provisioning)");
      }
      await stopVpsOnProxmox(vpsId, userId);
      break;
    case "reinstall":
      if (isProxmoxConfigured() && vps.proxmoxVmid) {
        await reinstallVpsOnProxmox(vpsId, userId, options?.os ?? vps.os);
      } else {
        await enqueueJob("vps.reinstall", {
          vpsId,
          os: options?.os ?? vps.os,
          proxmoxVmid: vps.proxmoxVmid,
        });
        await prisma.vpsInstance.update({
          where: { id: vpsId },
          data: { os: options?.os ?? vps.os },
        });
      }
      break;
    case "rescue":
      await prisma.vpsInstance.update({
        where: { id: vpsId },
        data: { rescueMode: true },
      });
      break;
    case "reset_password": {
      const password = Math.random().toString(36).slice(-12) + "A1!";
      await prisma.vpsInstance.update({
        where: { id: vpsId },
        data: { rootPasswordEnc: encrypt(password) },
      });
      return { password };
    }
  }

  return { success: true };
}

export async function getDedicatedInventory(locationId?: string) {
  return prisma.dedicatedInventory.findMany({
    where: {
      active: true,
      ...(locationId && { locationId }),
    },
    orderBy: { monthlyPrice: "asc" },
  });
}

export async function getUserDedicatedServers(userId: string) {
  return prisma.dedicatedServer.findMany({
    where: { service: { userId } },
    include: { service: true, location: true, inventory: true },
  });
}

export async function checkLowStockAlerts() {
  const items = await prisma.dedicatedInventory.findMany({
    where: { active: true },
  });
  return items.filter((i) => i.stockAvail <= i.lowStockAt);
}

export async function getNodes(locationId?: string) {
  return prisma.node.findMany({
    where: locationId ? { locationId } : undefined,
    include: { location: true },
    orderBy: { name: "asc" },
  });
}

export async function getLocations() {
  await ensureBulletproofVpsLocations();
  return prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}
