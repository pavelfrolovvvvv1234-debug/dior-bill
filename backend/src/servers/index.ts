import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { createAuditLog } from "../audit";
import { encrypt } from "../lib/crypto";
import { createServiceOrder } from "../core/provisioning/engine";
import { selectNodeForProvisioning } from "../core/inventory/service";
import {
  applyPromoToOrderTotal,
  createInvoice,
  finalizeOrderPromo,
  payInvoiceFromBalance,
  releasePromoRedemption,
} from "../billing";
import { assertBillingAllowed } from "../billing/guards";
import { getWallet } from "../payments/wallet";
import { enqueueJob } from "../lib/queue";
import {
  isProxmoxConfigured,
  rebootVpsOnProxmox,
  reinstallVpsOnProxmox,
  startVpsOnProxmox,
  stopVpsOnProxmox,
} from "../proxmox";
import { createHash, randomBytes } from "crypto";
import {
  BP_NETWORK_BASE_MBPS,
  calcBpNetworkMonthlyAddon,
  isValidBpNetworkMbps,
  normalizeBpNetworkMbps,
} from "@dior/shared";
import { ensureBulletproofVpsLocations, ensureStandardVpsLocations } from "./locations";

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
  await Promise.race([
    syncVpsMetricsFromProxmox(vpsId).catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
  ]);
}

export { getVpsAccessInfo, formatVpsOsLabel, resolveVpsLoginUser, validateVpsBillingCredentials, assessVpsCredentialFields } from "./vps-access";
export type { VpsAccessInfo, VpsCredentialValidation } from "./vps-access";

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
  promoCode?: string;
  /** Bulletproof VPS: configurable uplink speed (150–1000 Mbps). */
  networkMbps?: number;
}) {
  await assertBillingAllowed(params.userId);

  await ensureBulletproofVpsLocations();

  const location = await prisma.location.findUnique({ where: { id: params.locationId } });
  if (!location?.active) throw new ValidationError("Location unavailable");

  const networkMbps = normalizeBpNetworkMbps(params.networkMbps ?? BP_NETWORK_BASE_MBPS);
  if (!isValidBpNetworkMbps(networkMbps)) {
    throw new ValidationError("Invalid network speed");
  }
  const networkAddon = calcBpNetworkMonthlyAddon(networkMbps);
  const monthlyTotal = params.plan.price + networkAddon;

  const idempotencyKey =
    params.idempotencyKey ??
    createHash("sha256")
      .update(
        `${params.userId}:${params.hostname}:${params.locationId}:${params.plan.cpuCores}:${params.plan.ramMb}:${params.plan.diskGb}:${networkMbps}`,
      )
      .digest("hex")
      .slice(0, 32);

  const existingOrder = await prisma.domainEvent.findUnique({
    where: { idempotencyKey: `service.created:${idempotencyKey}` },
  });
  if (existingOrder) {
    const serviceId = existingOrder.aggregateId;
    const vps = await prisma.vpsInstance.findFirst({ where: { serviceId } });
    if (vps) {
      const invoiceItem = await prisma.invoiceItem.findFirst({
        where: { serviceId },
        include: { invoice: true },
        orderBy: { invoice: { createdAt: "desc" } },
      });
      return {
        serviceId,
        vps,
        invoice: invoiceItem?.invoice ?? null,
      };
    }
  }

  const duplicateHostname = await prisma.service.findFirst({
    where: {
      userId: params.userId,
      type: "VPS",
      label: params.hostname,
      status: { in: ["PENDING", "PROVISIONING"] },
    },
  });
  if (duplicateHostname) {
    throw new ValidationError(
      "A server with this hostname is already being provisioned. Check My Services.",
    );
  }

  const node = await selectNodeForProvisioning(params.locationId);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "VPS",
    label: params.hostname,
    monthlyPrice: monthlyTotal,
    idempotencyKey,
    metadata: { locationId: params.locationId, os: params.os, networkMbps },
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
      cloudInit:
        networkMbps > BP_NETWORK_BASE_MBPS
          ? { networkMbps }
          : undefined,
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

  const promo = await applyPromoToOrderTotal(
    params.userId,
    params.promoCode,
    monthlyTotal,
  );

  const networkNote =
    networkMbps > BP_NETWORK_BASE_MBPS ? `, network ${networkMbps} Mbps` : "";
  const invoiceDescription =
    promo.discount > 0 && promo.promoCode
      ? `VPS: ${params.hostname}${networkNote} (promo ${promo.promoCode}: -$${promo.discount.toFixed(2)})`
      : `VPS: ${params.hostname}${networkNote}`;

  const invoice = await createInvoice({
    userId: params.userId,
    items: [
      {
        description: invoiceDescription,
        unitPrice: promo.chargeAmount,
        serviceId,
      },
    ],
  });

  if (params.prepaid || process.env.BILLING_AUTO_PROVISION === "true") {
    const wallet = await getWallet(params.userId);
    if (wallet.spendable >= promo.chargeAmount) {
      let promoClaimed = false;
      try {
        if (promo.promoId && promo.discount > 0) {
          await finalizeOrderPromo(params.userId, promo.promoId, promo.discount);
          promoClaimed = true;
        }
        await payInvoiceFromBalance(invoice.id, params.userId);
        // Provisioning is started by invoice.paid / payment.confirmed event handlers.
      } catch (err) {
        if (promoClaimed && promo.promoId) {
          await releasePromoRedemption(params.userId, promo.promoId).catch(() => undefined);
        }
        throw err;
      }
    } else if (params.prepaid) {
      const { emitPaymentConfirmed } = await import("../core/billing/engine");
      if (promo.promoId && promo.discount > 0) {
        await finalizeOrderPromo(params.userId, promo.promoId, promo.discount);
      }
      await emitPaymentConfirmed({
        userId: params.userId,
        invoiceId: invoice.id,
        amount: promo.chargeAmount,
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
      const password =
        randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
      await prisma.vpsInstance.update({
        where: { id: vpsId },
        data: { rootPasswordEnc: encrypt(password) },
      });
      if (isProxmoxConfigured() && vps.proxmoxVmid) {
        await enqueueJob("vps.ensure_access", { vpsId, reboot: true, forceStop: false });
      }
      return { success: true, passwordResetQueued: true };
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
  await ensureStandardVpsLocations();
  return prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export { createVpsUpgradeInvoice } from "./vps-upgrade";
