import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { ValidationError } from "@dior/shared";
import { appendDomainEvent } from "../events/store";
import { isProxmoxConfigured } from "../../proxmox/config";
import { isPlaceholderIp, isProxmoxIpPoolConfigured } from "../../proxmox/ip-pool";

function usesProxmoxTemplateNetwork(): boolean {
  return isProxmoxConfigured() && !(process.env.PROXMOX_IP_POOL?.trim());
}

/**
 * InventoryService — SOLE owner of Node/IP/capacity mutations.
 */
export async function selectNodeForProvisioning(locationId: string) {
  const templateOnly = usesProxmoxTemplateNetwork();
  const node = await prisma.node.findFirst({
    where: {
      locationId,
      status: "online",
      ...(templateOnly
        ? {}
        : { capacityPercent: { lt: 95 }, ipv4Available: { gt: 0 } }),
    },
    orderBy: [{ capacityPercent: "asc" }, { loadPercent: "asc" }],
  });

  if (!node) {
    throw new ValidationError(
      templateOnly
        ? "No online node in this location"
        : "No capacity available in this location",
    );
  }

  return node;
}

export async function allocateIpTransactional(params: {
  locationId: string;
  nodeId?: string;
  vpsId: string;
  idempotencyKey: string;
  /** Skip IPs already on Proxmox / TG bot / reserved list */
  excludeAddresses?: ReadonlySet<string>;
}): Promise<string> {
  const existing = await prisma.domainEvent.findUnique({
    where: { idempotencyKey: `ip.alloc:${params.idempotencyKey}` },
  });
  if (existing) {
    return (existing.payload as { address: string }).address;
  }

  const address = await prisma.$transaction(async (tx) => {
    const candidates = await tx.ipAddress.findMany({
      where: {
        locationId: params.locationId,
        status: "available",
        ...(params.nodeId ? { nodeId: params.nodeId } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: isProxmoxConfigured() && !isProxmoxIpPoolConfigured() ? 0 : 50,
    });

    const ip =
      isProxmoxConfigured() && !isProxmoxIpPoolConfigured()
        ? null
        : candidates.find(
            (row) =>
              !isPlaceholderIp(row.address) &&
              !params.excludeAddresses?.has(row.address),
          ) ??
          candidates.find((row) => !params.excludeAddresses?.has(row.address)) ??
          null;

    if (!ip) {
      if (isProxmoxConfigured() && !isProxmoxIpPoolConfigured()) {
        throw new ValidationError(
          "Proxmox template mode — IP is assigned on the VM, not from billing inventory",
        );
      }
      throw new ValidationError("No IPv4 addresses available");
    }

    const node = ip.nodeId
      ? await tx.node.findUnique({ where: { id: ip.nodeId } })
      : null;

    if (node && node.ipv4Available <= 0) {
      throw new ValidationError("Node IPv4 pool exhausted");
    }

    await tx.ipAddress.update({
      where: { id: ip.id, status: "available" },
      data: { status: "assigned", vpsId: params.vpsId },
    });

    if (node) {
      await tx.node.update({
        where: { id: node.id },
        data: {
          ipv4Available: { decrement: 1 },
          activeVps: { increment: 1 },
        },
      });
    }

    return ip.address;
  });

  const ipRow = await prisma.ipAddress.findFirst({
    where: { address, vpsId: params.vpsId },
  });

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.IP_ALLOCATED,
    aggregateType: "ip",
    aggregateId: ipRow?.id ?? params.vpsId,
    payload: {
      address,
      vpsId: params.vpsId,
      nodeId: params.nodeId,
    },
    idempotencyKey: `ip.alloc:${params.idempotencyKey}`,
  });

  return address;
}

export async function releaseIpTransactional(params: {
  address: string;
  idempotencyKey: string;
}): Promise<void> {
  const idemKey = `ip.release:${params.idempotencyKey}`;
  const existing = await prisma.domainEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const ip = await tx.ipAddress.findFirst({
      where: { address: params.address, status: "assigned" },
    });
    if (!ip) return;

    await tx.ipAddress.update({
      where: { id: ip.id },
      data: { status: "available", vpsId: null },
    });

    if (ip.nodeId) {
      await tx.node.update({
        where: { id: ip.nodeId },
        data: {
          ipv4Available: { increment: 1 },
          activeVps: { decrement: 1 },
        },
      });
    }

  });

  const ipRow = await prisma.ipAddress.findFirst({ where: { address: params.address } });
  if (ipRow) {
    await appendDomainEvent({
      eventType: DOMAIN_EVENTS.IP_RELEASED,
      aggregateType: "ip",
      aggregateId: ipRow.id,
      payload: { address: params.address },
      idempotencyKey: idemKey,
    });
  }
}

export async function syncNodeCapacityFromDb(): Promise<number> {
  const nodes = await prisma.node.findMany();
  let updated = 0;

  for (const node of nodes) {
    const [assigned, available] = await Promise.all([
      prisma.ipAddress.count({ where: { nodeId: node.id, status: "assigned" } }),
      prisma.ipAddress.count({ where: { nodeId: node.id, status: "available" } }),
    ]);
    const total = assigned + available;
    const capacityPercent = total > 0 ? (assigned / total) * 100 : node.capacityPercent;

    await prisma.node.update({
      where: { id: node.id },
      data: {
        activeVps: assigned,
        ipv4Available: available,
        ipv4Total: total || node.ipv4Total,
        capacityPercent,
      },
    });
    updated++;
  }

  return updated;
}
