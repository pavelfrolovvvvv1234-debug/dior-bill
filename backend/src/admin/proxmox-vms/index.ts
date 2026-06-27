import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { decrypt } from "../../lib/crypto";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";
import { getProxmoxClient, getProxmoxNodeName } from "../../proxmox/client";
import { getProxmoxCiUser, isProxmoxConfigured } from "../../proxmox/config";
import { getSharedRegistryNetwork } from "../../proxmox/shared-ip-registry";
import { collectTelegramBotServersFromDatabase, type TelegramBotServerRow } from "../../proxmox/tg-bot-servers";
import {
  formatVpsOsLabel,
  isWindowsVpsOs,
  resolveVpsLoginUser,
} from "../../servers/vps-access";

export type AdminClusterVpsSource = "billing" | "telegram_bot" | "manual" | "unknown";

export type AdminClusterVpsRow = {
  vmid: number;
  node: string;
  name: string;
  proxmoxStatus: string;
  ip: string | null;
  source: AdminClusterVpsSource;
  serviceId: string | null;
  vpsId: string | null;
  customerEmail: string | null;
  customerRef: string | null;
  billingStatus: string | null;
  monthlyPrice: number | null;
  externalServiceId: string | null;
  detailHref: string;
  hasPassword: boolean;
};

export type AdminClusterVpsDetail = {
  vmid: number;
  node: string;
  name: string;
  proxmoxStatus: string;
  ip: string | null;
  ipsFromConfig: string[];
  guestAgentIps: string[];
  source: AdminClusterVpsSource;
  serviceId: string | null;
  vpsId: string | null;
  customerEmail: string | null;
  customerRef: string | null;
  billingStatus: string | null;
  monthlyPrice: number | null;
  externalServiceId: string | null;
  os: string | null;
  login: string;
  password: string | null;
  passwordSource: "billing" | "telegram_bot" | null;
  sshCommand: string | null;
  rdpTarget: string | null;
  proxmoxConfig: Record<string, string>;
  proxmoxMetrics: {
    cpu?: number;
    mem?: number;
    maxmem?: number;
  } | null;
  registry: {
    ip: string;
    owner: string;
    status: string;
    externalServiceId: string | null;
  } | null;
  billing: {
    hostname: string;
    cpuCores: number;
    ramMb: number;
    diskGb: number;
    location: string | null;
    nodeName: string | null;
  } | null;
  warnings: string[];
};

type BillingVpsWithRelations = Awaited<
  ReturnType<
    typeof prisma.vpsInstance.findMany<{
      include: {
        service: { include: { user: { select: { id: true; email: true } } } };
        node: { select: { name: true; proxmoxNode: true } };
        location: { select: { code: true; country: true } };
      };
    }>
  >
>[number];

type IpAllocationRow = Awaited<
  ReturnType<
    typeof prisma.networkIpAllocation.findMany<{
      where: { status: { in: ["reserved", "active"] }; vmid: { not: null } };
    }>
  >
>[number];

type ClusterContext = {
  billingByVmid: Map<number, BillingVpsWithRelations>;
  allocByVmid: Map<number, IpAllocationRow>;
  allocByIp: Map<string, IpAllocationRow>;
  botByVmid: Map<number, TelegramBotServerRow>;
  botByIp: Map<string, TelegramBotServerRow>;
};

function resolveSource(params: {
  hasBilling: boolean;
  allocOwner: string | null;
  hasBot: boolean;
}): AdminClusterVpsSource {
  if (params.hasBilling) return "billing";
  if (params.allocOwner === "telegram_bot" || params.hasBot) return "telegram_bot";
  if (params.allocOwner === "manual") return "manual";
  return "unknown";
}

async function findVmOnCluster(vmid: number): Promise<{ node: string; name: string; status: string } | null> {
  const client = getProxmoxClient();
  if (!client) return null;

  const nodes = await client.listNodes();
  for (const { node } of nodes) {
    const vms = await client.listVms(node);
    const hit = vms.find((vm) => vm.vmid === vmid && vm.template !== 1);
    if (hit) {
      return { node, name: hit.name ?? `vm-${vmid}`, status: hit.status ?? "unknown" };
    }
  }
  return null;
}

async function loadClusterContext(): Promise<ClusterContext> {
  const [billingVps, allocations, botServers] = await Promise.all([
    prisma.vpsInstance.findMany({
      include: {
        service: { include: { user: { select: { id: true, email: true } } } },
        node: { select: { name: true, proxmoxNode: true } },
        location: { select: { code: true, country: true } },
      },
    }),
    prisma.networkIpAllocation.findMany({
      where: {
        status: { in: ["reserved", "active"] },
        vmid: { not: null },
      },
    }),
    collectTelegramBotServersFromDatabase(),
  ]);

  const billingByVmid = new Map<number, BillingVpsWithRelations>();
  for (const vps of billingVps) {
    if (vps.proxmoxVmid != null) billingByVmid.set(vps.proxmoxVmid, vps);
  }

  const allocByVmid = new Map<number, IpAllocationRow>();
  const allocByIp = new Map<string, IpAllocationRow>();
  for (const row of allocations) {
    if (row.vmid != null) allocByVmid.set(row.vmid, row);
    allocByIp.set(row.ip, row);
  }

  const botByVmid = new Map<number, TelegramBotServerRow>();
  const botByIp = new Map<string, TelegramBotServerRow>();
  for (const row of botServers) {
    if (row.vmid != null) botByVmid.set(row.vmid, row);
    if (row.ip) botByIp.set(row.ip, row);
  }

  return { billingByVmid, allocByVmid, allocByIp, botByVmid, botByIp };
}

function buildClusterRow(params: {
  vmid: number;
  node: string;
  name: string;
  proxmoxStatus: string;
  billing?: BillingVpsWithRelations;
  alloc?: IpAllocationRow;
  bot?: TelegramBotServerRow;
}): AdminClusterVpsRow {
  const { billing, alloc, bot } = params;
  const ip = billing?.primaryIp ?? alloc?.ip ?? bot?.ip ?? null;
  const source = resolveSource({
    hasBilling: Boolean(billing),
    allocOwner: alloc?.owner ?? null,
    hasBot: Boolean(bot),
  });

  const hasPassword = Boolean(billing?.rootPasswordEnc || bot?.password);
  const serviceId = billing?.serviceId ?? null;

  return {
    vmid: params.vmid,
    node: params.node,
    name: billing?.hostname ?? params.name,
    proxmoxStatus: params.proxmoxStatus,
    ip,
    source,
    serviceId,
    vpsId: billing?.id ?? null,
    customerEmail: billing?.service.user.email ?? null,
    customerRef: bot?.customerRef ?? alloc?.externalServiceId ?? null,
    billingStatus: billing?.service.status ?? null,
    monthlyPrice: billing ? Number(billing.service.monthlyPrice) : null,
    externalServiceId: alloc?.externalServiceId ?? bot?.externalId ?? null,
    detailHref: serviceId ? `/services/${serviceId}` : `/vms/${params.vmid}`,
    hasPassword,
  };
}

export async function listAdminClusterVps(
  actorId: string,
  options: {
    q?: string;
    source?: AdminClusterVpsSource;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "services.read");

  if (!isProxmoxConfigured()) {
    throw new ValidationError("Proxmox is not configured");
  }

  const client = getProxmoxClient();
  if (!client) throw new ValidationError("Proxmox client unavailable");

  const ctx = await loadClusterContext();
  const q = options.q?.trim().toLowerCase();
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 50, 200);

  const rows: AdminClusterVpsRow[] = [];
  const nodes = await client.listNodes();

  for (const { node } of nodes) {
    const vms = await client.listVms(node);
    for (const vm of vms) {
      if (vm.template === 1) continue;

      const billing = ctx.billingByVmid.get(vm.vmid);
      let alloc = ctx.allocByVmid.get(vm.vmid);
      let bot = ctx.botByVmid.get(vm.vmid);

      const row = buildClusterRow({
        vmid: vm.vmid,
        node,
        name: vm.name ?? `vm-${vm.vmid}`,
        proxmoxStatus: vm.status ?? "unknown",
        billing,
        alloc,
        bot,
      });

      if (!bot && row.ip) bot = ctx.botByIp.get(row.ip);
      if (!alloc && row.ip) alloc = ctx.allocByIp.get(row.ip);

      if (options.source && row.source !== options.source) continue;

      if (q) {
        const hay = [
          row.name,
          row.ip,
          String(row.vmid),
          row.customerEmail,
          row.customerRef,
          row.externalServiceId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }

      rows.push(row);
    }
  }

  rows.sort((a, b) => b.vmid - a.vmid);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminClusterVpsDetail(
  actorId: string,
  vmid: number,
): Promise<AdminClusterVpsDetail> {
  await requirePermission(actorId, "services.read");

  if (!isProxmoxConfigured()) {
    throw new ValidationError("Proxmox is not configured");
  }

  const client = getProxmoxClient();
  if (!client) throw new ValidationError("Proxmox client unavailable");

  const located = await findVmOnCluster(vmid);
  if (!located) throw new NotFoundError(`VMID ${vmid} not found on Proxmox cluster`);

  const ctx = await loadClusterContext();
  const billing = ctx.billingByVmid.get(vmid);
  let alloc = ctx.allocByVmid.get(vmid);
  let bot = ctx.botByVmid.get(vmid);

  const [config, status] = await Promise.all([
    client.getVmConfig(located.node, vmid).catch(() => ({} as Record<string, string>)),
    client.getVmStatus(located.node, vmid).catch(() => null),
  ]);

  const ipsFromConfig = client.parseIpsFromVmConfig(config);
  const ipFromConfig = client.parseIpFromConfig(config);

  let guestAgentIps: string[] = [];
  try {
    guestAgentIps = await client.getGuestAgentIps(located.node, vmid);
  } catch {
    /* guest agent off */
  }

  const ip =
    billing?.primaryIp ??
    alloc?.ip ??
    bot?.ip ??
    ipFromConfig ??
    ipsFromConfig[0] ??
    guestAgentIps[0] ??
    null;

  if (!bot && ip) bot = ctx.botByIp.get(ip);
  if (!alloc && ip) alloc = ctx.allocByIp.get(ip);

  const source = resolveSource({
    hasBilling: Boolean(billing),
    allocOwner: alloc?.owner ?? null,
    hasBot: Boolean(bot),
  });

  const os = billing?.os ?? null;
  const ciuser = config.ciuser?.trim();
  const login =
    bot?.login ?? (billing ? resolveVpsLoginUser(billing.os) : ciuser || getProxmoxCiUser());

  const warnings: string[] = [];
  let password: string | null = null;
  let passwordSource: "billing" | "telegram_bot" | null = null;

  if (billing?.rootPasswordEnc) {
    try {
      password = decrypt(billing.rootPasswordEnc);
      passwordSource = "billing";
    } catch {
      warnings.push("Billing password cannot be decrypted — check ENCRYPTION_KEY");
    }
  } else if (bot?.password) {
    password = bot.password;
    passwordSource = "telegram_bot";
  } else {
    warnings.push("No password in billing DB or Telegram bot SQL");
  }

  if (ciuser && login !== ciuser) {
    warnings.push(`Proxmox ciuser=${ciuser}, shown login=${login}`);
  }

  const windows = os ? isWindowsVpsOs(os) : false;

  return {
    vmid,
    node: located.node,
    name: billing?.hostname ?? located.name,
    proxmoxStatus: status?.status ?? located.status,
    ip,
    ipsFromConfig,
    guestAgentIps,
    source,
    serviceId: billing?.serviceId ?? null,
    vpsId: billing?.id ?? null,
    customerEmail: billing?.service.user.email ?? null,
    customerRef: bot?.customerRef ?? alloc?.externalServiceId ?? null,
    billingStatus: billing?.service.status ?? null,
    monthlyPrice: billing ? Number(billing.service.monthlyPrice) : null,
    externalServiceId: alloc?.externalServiceId ?? bot?.externalId ?? null,
    os: os ? formatVpsOsLabel(os) : null,
    login,
    password,
    passwordSource,
    sshCommand: ip && !windows ? `ssh ${login}@${ip}` : null,
    rdpTarget: ip && windows ? ip : null,
    proxmoxConfig: config,
    proxmoxMetrics: status
      ? { cpu: status.cpu, mem: status.mem, maxmem: status.maxmem }
      : null,
    registry: alloc
      ? {
          ip: alloc.ip,
          owner: alloc.owner,
          status: alloc.status,
          externalServiceId: alloc.externalServiceId,
        }
      : null,
    billing: billing
      ? {
          hostname: billing.hostname,
          cpuCores: billing.cpuCores,
          ramMb: billing.ramMb,
          diskGb: billing.diskGb,
          location: billing.location
            ? `${billing.location.code} · ${billing.location.country}`
            : null,
          nodeName: getProxmoxNodeName(billing.node?.proxmoxNode ?? billing.node?.name),
        }
      : null,
    warnings,
  };
}

export async function adminRegisterVpsInSharedRegistry(
  actorId: string,
  params: {
    vmid: number;
    ip: string;
    owner: "telegram_bot" | "billing" | "manual";
    externalServiceId?: string;
    hostname?: string;
  },
) {
  await requirePermission(actorId, "services.write");

  if (!getProxmoxClient()) throw new ValidationError("Proxmox not configured");

  const { resolveProxmoxNetwork } = await import("../../proxmox/ip-allocate");
  const network = await resolveProxmoxNetwork("debian12");
  const networkCidr = getSharedRegistryNetwork(network);

  const existing = await prisma.networkIpAllocation.findUnique({ where: { ip: params.ip } });
  if (existing && existing.status !== "released" && existing.vmid !== params.vmid) {
    throw new ValidationError(`IP ${params.ip} already allocated to VMID ${existing.vmid ?? "?"}`);
  }

  const row = existing
    ? await prisma.networkIpAllocation.update({
        where: { id: existing.id },
        data: {
          network: networkCidr,
          owner: params.owner,
          status: "active",
          vmid: params.vmid,
          externalServiceId: params.externalServiceId ?? existing.externalServiceId,
          hostname: params.hostname ?? existing.hostname,
          releasedAt: null,
          notes: existing.notes ?? "admin: registered in shared IP registry",
        },
      })
    : await prisma.networkIpAllocation.create({
        data: {
          ip: params.ip,
          network: networkCidr,
          owner: params.owner,
          status: "active",
          vmid: params.vmid,
          externalServiceId: params.externalServiceId,
          hostname: params.hostname,
          notes: "admin: registered in shared IP registry",
        },
      });

  await createAuditLog({
    actorId,
    action: "vps.registry.register",
    entityType: "network_ip_allocation",
    entityId: row.id,
    metadata: {
      vmid: params.vmid,
      ip: params.ip,
      owner: params.owner,
      externalServiceId: params.externalServiceId,
    },
  });

  return row;
}

export async function getAdminVpsAccessByServiceId(actorId: string, serviceId: string) {
  await requirePermission(actorId, "services.read");

  const vps = await prisma.vpsInstance.findFirst({
    where: { serviceId },
    include: { service: true, node: true },
  });
  if (!vps) return null;

  const login = resolveVpsLoginUser(vps.os);
  const host = vps.primaryIp;
  let password: string | null = null;
  if (vps.rootPasswordEnc) {
    try {
      password = decrypt(vps.rootPasswordEnc);
    } catch {
      password = null;
    }
  }

  let botPassword: string | null = null;
  let botLogin: string | null = null;
  if (vps.proxmoxVmid && !password) {
    const detail = await getAdminClusterVpsDetail(actorId, vps.proxmoxVmid).catch(() => null);
    if (detail?.passwordSource === "telegram_bot") {
      botPassword = detail.password;
      botLogin = detail.login;
    }
  }

  const username = botLogin ?? login;

  return {
    username,
    password: password ?? botPassword,
    host,
    sshPort: 22,
    sshCommand: host && !isWindowsVpsOs(vps.os) ? `ssh ${username}@${host}` : null,
    rdpTarget: host && isWindowsVpsOs(vps.os) ? host : null,
    proxmoxVmid: vps.proxmoxVmid,
    serviceStatus: vps.service.status,
    rescueMode: vps.rescueMode,
    osLabel: formatVpsOsLabel(vps.os),
  };
}
