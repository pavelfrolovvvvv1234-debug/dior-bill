import { randomBytes } from "crypto";
import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { encrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName, ProxmoxApiError } from "./client";
import { getProxmoxConfig, isProxmoxConfigured, proxmoxTlsHint } from "./config";
import { resolveTemplateVmid } from "./os-templates";

export {
  ProxmoxClient,
  ProxmoxApiError,
  getProxmoxClient,
  getProxmoxNodeName,
} from "./client";
export { getProxmoxConfig, isProxmoxConfigured, proxmoxTlsHint } from "./config";
export { resolveTemplateVmid } from "./os-templates";

export async function verifyProxmoxIntegration(): Promise<{
  ok: true;
  node: string;
  nodes: Array<{ node: string; status: string }>;
  nextVmid: number;
  templates: number;
}> {
  const client = getProxmoxClient();
  if (!client) {
    throw new ValidationError("Proxmox is not configured (check PROXMOX_BASE_URL, tokens)");
  }
  const config = getProxmoxConfig()!;
  const nodes = await client.listNodes();
  const nextVmid = await client.getNextVmid();
  return {
    ok: true,
    node: config.node,
    nodes,
    nextVmid,
    templates: Object.keys(config.templateMap).length,
  };
}

export async function provisionVmOnProxmox(spec: {
  vpsId: string;
  nodeName: string;
  hostname: string;
  cores: number;
  ramMb: number;
  diskGb: number;
  os: string;
  locationId: string;
  primaryIp?: string;
}): Promise<{ vmid: number; ip: string }> {
  const client = getProxmoxClient();
  const config = getProxmoxConfig();

  if (!client || !config) {
    await new Promise((r) => setTimeout(r, 500));
    const vmid = Math.floor(Math.random() * 8000) + 200;
    const ip = spec.primaryIp ?? `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    return { vmid, ip };
  }

  if (!spec.primaryIp) {
    throw new ValidationError("No IPv4 available for this location — add IPs to inventory");
  }

  const node = spec.nodeName || config.node;
  const vmid = await client.getNextVmid();
  const templateVmid = resolveTemplateVmid(spec.os, config);
  const rootPassword = randomBytes(10).toString("base64url").slice(0, 16) + "A1!";

  const vmSpec = {
    vmid,
    node,
    hostname: spec.hostname,
    cores: spec.cores,
    memoryMb: spec.ramMb,
    diskGb: spec.diskGb,
    templateVmid,
    primaryIp: spec.primaryIp,
    storage: config.storage,
    bridge: config.bridge,
  };

  await client.cloneFromTemplate(vmSpec);
  await client.configureVm(vmSpec);
  await client.startVm(node, vmid);

  await prisma.vpsInstance.update({
    where: { id: spec.vpsId },
    data: { rootPasswordEnc: encrypt(rootPassword), proxmoxVmid: vmid },
  });

  return { vmid, ip: spec.primaryIp };
}

/** Remove a partially created VM after failed provision (best-effort). */
export async function destroyProxmoxVmIfExists(node: string, vmid: number): Promise<void> {
  const client = getProxmoxClient();
  if (!client) return;
  try {
    await client.stopVm(node, vmid);
  } catch {
    /* may not be running */
  }
  try {
    await client.deleteVm(node, vmid);
  } catch {
    /* already gone */
  }
}

async function loadVpsForProxmox(vpsId: string, userId?: string) {
  const vps = await prisma.vpsInstance.findFirst({
    where: {
      id: vpsId,
      ...(userId ? { service: { userId } } : {}),
    },
    include: { node: true, service: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");
  if (!vps.proxmoxVmid) {
    throw new ValidationError("VPS is not linked to Proxmox yet (still provisioning?)");
  }
  return vps;
}

function resolveNode(vps: { node: { proxmoxNode: string | null; name: string } | null }) {
  return getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
}

function requireProxmoxClient() {
  const client = getProxmoxClient();
  if (!client) {
    throw new ValidationError(
      "Proxmox is not configured — add PROXMOX_BASE_URL, PROXMOX_TOKEN_ID, PROXMOX_TOKEN_SECRET to .env",
    );
  }
  return client;
}

export async function rebootVpsOnProxmox(vpsId: string, userId?: string): Promise<void> {
  const client = requireProxmoxClient();
  const vps = await loadVpsForProxmox(vpsId, userId);
  await client.rebootVm(resolveNode(vps), vps.proxmoxVmid!);
}

export async function stopVpsOnProxmox(vpsId: string, userId?: string): Promise<void> {
  const client = requireProxmoxClient();
  const vps = await loadVpsForProxmox(vpsId, userId);
  await client.stopVm(resolveNode(vps), vps.proxmoxVmid!);
}

export async function startVpsOnProxmox(vpsId: string, userId?: string): Promise<void> {
  const client = requireProxmoxClient();
  const vps = await loadVpsForProxmox(vpsId, userId);
  await client.startVm(resolveNode(vps), vps.proxmoxVmid!);
}

export async function syncVpsMetricsFromProxmox(vpsId: string): Promise<void> {
  const client = getProxmoxClient();
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true },
  });
  if (!client || !vps?.proxmoxVmid) return;

  try {
    const status = await client.getVmStatus(resolveNode(vps), vps.proxmoxVmid);
    const cpuPct =
      status.cpu != null && vps.cpuCores > 0
        ? Math.min(100, Math.round((status.cpu / vps.cpuCores) * 100))
        : vps.cpuUsage;
    const ramPct =
      status.mem != null && status.maxmem
        ? Math.min(100, Math.round((status.mem / status.maxmem) * 100))
        : vps.ramUsage;

    await prisma.vpsInstance.update({
      where: { id: vpsId },
      data: {
        cpuUsage: cpuPct,
        ramUsage: ramPct,
      },
    });
  } catch {
    /* non-fatal */
  }
}

export async function reinstallVpsOnProxmox(
  vpsId: string,
  userId: string,
  os?: string,
): Promise<void> {
  const vps = await loadVpsForProxmox(vpsId, userId);
  const client = getProxmoxClient();
  const config = getProxmoxConfig();
  if (!client || !config) {
    throw new ValidationError("Proxmox is not configured");
  }

  const node = resolveNode(vps);
  const vmid = vps.proxmoxVmid!;
  const targetOs = os ?? vps.os;

  try {
    await client.stopVm(node, vmid);
  } catch {
    /* may already be stopped */
  }
  await client.deleteVm(node, vmid);

  const newVmid = await client.getNextVmid();
  const templateVmid = resolveTemplateVmid(targetOs, config);
  const vmSpec = {
    vmid: newVmid,
    node,
    hostname: vps.hostname,
    cores: vps.cpuCores,
    memoryMb: vps.ramMb,
    diskGb: vps.diskGb,
    templateVmid,
    primaryIp: vps.primaryIp ?? undefined,
    storage: config.storage,
    bridge: config.bridge,
  };

  await client.cloneFromTemplate(vmSpec);
  await client.configureVm(vmSpec);
  await client.startVm(node, newVmid);

  const rootPassword = randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
  await prisma.vpsInstance.update({
    where: { id: vpsId },
    data: {
      os: targetOs,
      proxmoxVmid: newVmid,
      rootPasswordEnc: encrypt(rootPassword),
      rescueMode: false,
    },
  });
}
