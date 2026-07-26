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
  assertOsHasTemplate,
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
  if (vps.provider === "hostvds") return;
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
  /** Compute backend — default proxmox (bulletproof). */
  provider?: "proxmox" | "hostvds";
  /** Catalog plan id (used for HostVDS flavor map). */
  planId?: string;
}) {
  await assertBillingAllowed(params.userId);

  const provider = params.provider ?? "proxmox";

  if (provider === "hostvds") {
    const { isHostVdsConfigured } = await import("../hostvds");
    if (!isHostVdsConfigured()) {
      throw new ValidationError(
        "Standard VPS is temporarily unavailable — HostVDS is not configured",
      );
    }
    await ensureStandardVpsLocations();
  } else {
    await ensureBulletproofVpsLocations();
  }

  const location = await prisma.location.findUnique({ where: { id: params.locationId } });
  if (!location?.active) throw new ValidationError("Location unavailable");

  const os = params.os ?? "debian-12";
  if (provider === "proxmox" && isProxmoxConfigured()) {
    assertOsHasTemplate(os);
  }
  if (provider === "hostvds") {
    const { resolveHostVdsImageId, resolveHostVdsFlavorId, isHostVdsLocationCode } =
      await import("../hostvds");
    if (!isHostVdsLocationCode(location.code)) {
      throw new ValidationError("Select a HostVDS region from the list");
    }
    resolveHostVdsImageId(os);
    resolveHostVdsFlavorId({
      planId: params.planId,
      cpuCores: params.plan.cpuCores,
      ramMb: params.plan.ramMb,
      diskGb: params.plan.diskGb,
    });
  }

  const networkMbps =
    provider === "proxmox"
      ? normalizeBpNetworkMbps(params.networkMbps ?? BP_NETWORK_BASE_MBPS)
      : BP_NETWORK_BASE_MBPS;
  if (provider === "proxmox" && !isValidBpNetworkMbps(networkMbps)) {
    throw new ValidationError("Invalid network speed");
  }
  const networkAddon =
    provider === "proxmox" ? calcBpNetworkMonthlyAddon(networkMbps) : 0;
  const monthlyTotal = params.plan.price + networkAddon;

  const idempotencyKey =
    params.idempotencyKey ??
    createHash("sha256")
      .update(
        `${params.userId}:${params.hostname}:${params.locationId}:${params.plan.cpuCores}:${params.plan.ramMb}:${params.plan.diskGb}:${networkMbps}:${provider}`,
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

  const node =
    provider === "hostvds" ? null : await selectNodeForProvisioning(params.locationId);

  const { serviceId } = await createServiceOrder({
    userId: params.userId,
    type: "VPS",
    label: params.hostname,
    monthlyPrice: monthlyTotal,
    idempotencyKey,
    metadata: {
      locationId: params.locationId,
      os: params.os,
      networkMbps,
      provider,
      planId: params.planId,
    },
  });

  const vps = await prisma.vpsInstance.create({
    data: {
      serviceId,
      nodeId: node?.id,
      locationId: params.locationId,
      hostname: params.hostname,
      os: os,
      cpuCores: params.plan.cpuCores,
      ramMb: params.plan.ramMb,
      diskGb: params.plan.diskGb,
      bandwidthTb: params.plan.bandwidthTb,
      provider,
      cloudInit:
        provider === "proxmox" && networkMbps > BP_NETWORK_BASE_MBPS
          ? { networkMbps, planId: params.planId }
          : params.planId
            ? { planId: params.planId }
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
  action: "reboot" | "reinstall" | "rescue" | "reset_password" | "start" | "stop" | "delete",
  options?: { os?: string },
) {
  const vps = await getVpsById(vpsId, userId);
  const isHostVds = vps.provider === "hostvds";

  await createAuditLog({
    actorId: userId,
    action: `vps.${action}`,
    entityType: "vps",
    entityId: vpsId,
  });

  if (isHostVds) {
    const {
      isHostVdsConfigured,
      hostVdsRebootServer,
      hostVdsStartServer,
      hostVdsStopServer,
      hostVdsRebuildServer,
      hostVdsDeleteServer,
      resolveHostVdsImageName,
      generateHostVdsPassword,
      buildHostVdsCloudInitUserData,
      resolveHostVdsRegionForVps,
    } = await import("../hostvds");
    const { resolveImage } = await import("../hostvds/resolve");
    const region = resolveHostVdsRegionForVps(vps);

    const status = vps.service.status;

    if (action === "rescue") {
      throw new ValidationError("Rescue mode is not available for HostVDS servers");
    }

    if (action === "delete") {
      const toDeleted = ["ACTIVE", "FAILED", "SUSPENDED", "ROLLBACK", "EXPIRED"];
      const toCancelled = ["PENDING", "PROVISIONING"];
      if (!toDeleted.includes(status) && !toCancelled.includes(status)) {
        throw new ValidationError(`Cannot delete VPS while status is ${status}`);
      }
      if (vps.externalId) {
        if (!isHostVdsConfigured()) {
          throw new ValidationError(
            "Cannot delete remote server — HostVDS is not configured. Contact support.",
          );
        }
        await hostVdsDeleteServer(vps.externalId, { region });
      }
      await prisma.vpsInstance.update({
        where: { id: vpsId },
        data: { externalId: null, primaryIp: null },
      });
      const { cancelSubscription } = await import("../core/billing/subscriptions");
      await cancelSubscription(vps.serviceId, `vps:delete:sub:${vpsId}`).catch(() => undefined);
      const { transitionServiceLifecycle } = await import("../core/provisioning/engine");
      const target = toCancelled.includes(status) ? "CANCELLED" : "DELETED";
      await transitionServiceLifecycle({
        serviceId: vps.serviceId,
        to: target,
        reason: "customer_delete",
        actorId: userId,
        idempotencyKey: `vps:delete:${vpsId}`,
      });
      return { success: true };
    }

    if (!isHostVdsConfigured()) {
      throw new ValidationError("HostVDS is not configured on the server");
    }
    if (!vps.externalId) {
      throw new ValidationError("VPS is not linked to HostVDS yet (wait for provisioning)");
    }
    if (status !== "ACTIVE" && action !== "reset_password") {
      throw new ValidationError(`Cannot ${action} while status is ${status}`);
    }

    switch (action) {
      case "reboot":
        await hostVdsRebootServer(vps.externalId, "SOFT", { region });
        break;
      case "start":
        await hostVdsStartServer(vps.externalId, { region });
        break;
      case "stop":
        await hostVdsStopServer(vps.externalId, { region });
        break;
      case "reinstall": {
        const os = options?.os ?? vps.os;
        const password = generateHostVdsPassword();
        const { transitionServiceLifecycle } = await import("../core/provisioning/engine");
        const attemptKey = createHash("sha256")
          .update(`${vpsId}:${os}:${Date.now()}`)
          .digest("hex")
          .slice(0, 16);
        await transitionServiceLifecycle({
          serviceId: vps.serviceId,
          to: "REINSTALLING",
          reason: "customer_reinstall",
          actorId: userId,
          idempotencyKey: `vps:reinstall:start:${vpsId}:${attemptKey}`,
        });
        try {
          const imageRef = await resolveImage(resolveHostVdsImageName(os), region);
          await hostVdsRebuildServer(
            vps.externalId,
            imageRef,
            password,
            buildHostVdsCloudInitUserData(password),
            { region },
          );
          await prisma.vpsInstance.update({
            where: { id: vpsId },
            data: { os, rootPasswordEnc: encrypt(password) },
          });
          await transitionServiceLifecycle({
            serviceId: vps.serviceId,
            to: "ACTIVE",
            reason: "reinstall_complete",
            actorId: userId,
            idempotencyKey: `vps:reinstall:done:${vpsId}:${attemptKey}`,
          });
        } catch (err) {
          await transitionServiceLifecycle({
            serviceId: vps.serviceId,
            to: "FAILED",
            reason: "reinstall_failed",
            actorId: userId,
            idempotencyKey: `vps:reinstall:fail:${vpsId}:${attemptKey}`,
          }).catch(() => undefined);
          throw err;
        }
        break;
      }
      case "reset_password": {
        // Nova changePassword is unreliable on cloud images — rebuild with cloud-init.
        const password = generateHostVdsPassword();
        const imageRef = await resolveImage(resolveHostVdsImageName(vps.os), region);
        await hostVdsRebuildServer(
          vps.externalId,
          imageRef,
          password,
          buildHostVdsCloudInitUserData(password),
          { region },
        );
        await prisma.vpsInstance.update({
          where: { id: vpsId },
          data: { rootPasswordEnc: encrypt(password) },
        });
        return { success: true, passwordResetQueued: false, passwordSynced: true };
      }
      default:
        throw new ValidationError(`Unsupported action: ${action}`);
    }
    return { success: true };
  }

  switch (action) {
    case "delete":
      throw new ValidationError("Delete is not available for this VPS type");
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
      if (isProxmoxConfigured() && vps.proxmoxVmid && vps.primaryIp) {
        try {
          const { syncGuestPasswordForVps } = await import("../proxmox/guest-access");
          await syncGuestPasswordForVps(vpsId, password);
          return { success: true, passwordResetQueued: false, passwordSynced: true };
        } catch (e) {
          console.warn(
            `[vps] reset_password live sync failed for ${vps.hostname}:`,
            e instanceof Error ? e.message.slice(0, 160) : e,
          );
          await enqueueJob("vps.ensure_access", {
            vpsId,
            syncGuestPassword: true,
            reboot: false,
            forceStop: false,
          });
          return { success: true, passwordResetQueued: true, passwordSynced: false };
        }
      }
      if (isProxmoxConfigured() && vps.proxmoxVmid) {
        await enqueueJob("vps.ensure_access", {
          vpsId,
          syncGuestPassword: true,
          reboot: true,
          forceStop: false,
        });
        return { success: true, passwordResetQueued: true };
      }
      return { success: true, passwordResetQueued: false };
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
