import { randomBytes } from "crypto";
import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { encrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName, type VmSpec } from "./client";
import { getProxmoxConfig, isProxmoxConfigured, proxmoxTlsHint, resolveProxmoxCiUser } from "./config";
import { resolveTemplateVmid } from "./os-templates";
import { waitForVpsProvisionReady } from "./provision-ready";
import { repairVpsCloudInitNetwork } from "./repair-network";
import { finalizeGuestNetworkAfterBoot } from "./guest-cloud-init";
import {
  getProxmoxGateway,
  isPlaceholderIp,
  isProxmoxIpPoolConfigured,
} from "./ip-pool";
import { enqueueJob } from "../lib/queue";

export {
  ProxmoxClient,
  ProxmoxApiError,
  getProxmoxClient,
  getProxmoxNodeName,
} from "./client";
export { getProxmoxConfig, isProxmoxConfigured, getProxmoxCiUser, resolveProxmoxCiUser, proxmoxTlsHint } from "./config";
export { ensureVpsProxmoxAccess } from "./ensure-vps-access";
export { waitForVpsProvisionReady } from "./provision-ready";
export { repairVpsCloudInitNetwork, runVpsNetworkRepairJob } from "./repair-network";
export { rebuildVpsKeepingIp } from "./rebuild-fresh";
export { resolveTemplateVmid } from "./os-templates";
export {
  isPlaceholderIp,
  isProxmoxIpPoolConfigured,
  parseProxmoxIpPool,
  parseProxmoxReservedIps,
  purgePlaceholderIpsFromInventory,
  syncProxmoxIpPoolFromEnv,
} from "./ip-pool";
export {
  allocateStaticIpForVps,
  collectAllUsedProxmoxIps,
  reserveProxmoxOccupiedIps,
  resolveProxmoxNetwork,
  syncProxmoxUsedIpsToInventory,
} from "./ip-allocate";
export {
  activateSharedRegistryIp,
  getSharedRegistryNetwork,
  isSharedIpRegistryEnabled,
  isSharedIpRegistryRequired,
  listOccupiedSharedRegistryIps,
  releaseSharedRegistryIp,
  releaseSharedRegistryIpByVmid,
  releaseSharedRegistryIpByVpsId,
  releaseStaleSharedRegistryReservations,
  reconcileSharedRegistryWithProxmox,
  reserveBillingIpInSharedRegistry,
  syncSharedRegistryFromProxmox,
} from "./shared-ip-registry";
export {
  syncProxmoxClusterToRegistry,
  invalidateProxmoxRegistrySyncCache,
} from "./proxmox-registry-sync";
export {
  teardownVpsNetworkResources,
  teardownVpsNetworkResourcesForService,
} from "./vps-network-teardown";

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

async function bootVmWithCloudInit(
  client: NonNullable<ReturnType<typeof getProxmoxClient>>,
  node: string,
  vmid: number,
  vmSpec: VmSpec,
  config: NonNullable<ReturnType<typeof getProxmoxConfig>>,
  options: { clone: boolean; templateVmid: number },
): Promise<void> {
  if (options.clone) {
    console.log(
      `[proxmox] provision ${vmSpec.hostname} from template ${options.templateVmid}${vmSpec.primaryIp ? ` static ${vmSpec.primaryIp}` : ""}`,
    );
    await client.cloneFromTemplate({ ...vmSpec, vmid, templateVmid: options.templateVmid });
    const stAfterClone = await client.getVmStatus(node, vmid).catch(() => ({ status: "stopped" }));
    if (stAfterClone.status === "running") {
      console.log(`[proxmox] stopping vmid ${vmid} after clone — apply cloud-init before first boot`);
      await client.stopVm(node, vmid);
    }
  } else {
    const st = await client.getVmStatus(node, vmid).catch(() => ({ status: "stopped" }));
    if (st.status === "running") {
      console.log(`[proxmox] stopping vmid ${vmid} for cloud-init repair...`);
      await client.stopVm(node, vmid);
    }
  }

  await client.rebuildCloudInitDrive(node, vmid, config.storage).catch(async () => {
    await client.ensureCloudInitDrive(node, vmid, config.storage);
  });
  await client.configureVm(vmSpec);
  await client.regenerateCloudInit(node, vmid);
  await client.startVm(node, vmid);
}

async function waitGuestSshReady(
  node: string,
  vmid: number,
  primaryIp: string,
  vmSpec: VmSpec & { os?: string },
): Promise<boolean> {
  let ready = await waitForVpsProvisionReady(node, vmid, primaryIp);
  if (!ready) {
    console.warn(`[proxmox] ${vmSpec.hostname} vmid=${vmid} network pending — cloud-init repair`);
    ready = await repairVpsCloudInitNetwork({ ...vmSpec, os: vmSpec.os });
  }
  return ready;
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

  const useStaticIp = !!spec.primaryIp && !isPlaceholderIp(spec.primaryIp);

  const node = spec.nodeName || config.node;

  const vpsRow = await prisma.vpsInstance.findUnique({
    where: { id: spec.vpsId },
    select: { proxmoxVmid: true, primaryIp: true, rootPasswordEnc: true },
  });

  const ciuser = resolveProxmoxCiUser(spec.os);
  const expectedIp = useStaticIp ? (spec.primaryIp ?? vpsRow?.primaryIp ?? undefined) : undefined;

  let vmid: number | null = vpsRow?.proxmoxVmid ?? null;
  let needsClone = true;

  if (vmid && (await client.vmConfigExists(node, vmid))) {
    const cfg = await client.getVmConfig(node, vmid);
    if (client.isCloudInitNetworkReady(cfg, expectedIp, ciuser)) {
      if (expectedIp) {
        const sshReady = await waitForVpsProvisionReady(node, vmid, expectedIp, { repair: true });
        if (sshReady) {
          console.log(`[proxmox] ${spec.hostname} vmid=${vmid} SSH ready — skip re-clone`);
          return { vmid, ip: expectedIp };
        }
        console.warn(
          `[proxmox] ${spec.hostname} vmid=${vmid} hypervisor OK but guest SSH down — destroying for fresh clone`,
        );
        await destroyProxmoxVmIfExists(node, vmid);
        vmid = null;
        needsClone = true;
      } else {
        const ip =
          client.parseIpFromConfig(cfg) ?? vpsRow?.primaryIp ?? spec.primaryIp ?? "";
        console.log(`[proxmox] ${spec.hostname} vmid=${vmid} cloud-init OK on ${node} — skip re-clone`);
        return { vmid, ip };
      }
    } else {
      console.warn(
        `[proxmox] ${spec.hostname} vmid=${vmid} exists but cloud-init incomplete — reconfiguring (net0=${cfg.net0 ?? "?"})`,
      );
      needsClone = false;
    }
  }

  if (useStaticIp && spec.primaryIp && needsClone) {
    const prefix = spec.primaryIp.split(".").slice(0, 3).join(".");
    if (await client.isIpInUseOnCluster(spec.primaryIp, prefix)) {
      const linked = await findProxmoxVmidByHostname(spec.hostname, node);
      if (linked) {
        await prisma.vpsInstance.update({
          where: { id: spec.vpsId },
          data: { proxmoxVmid: linked.vmid },
        });
        console.log(
          `[proxmox] ${spec.hostname} linked to existing vmid=${linked.vmid} ip=${spec.primaryIp}`,
        );
        return { vmid: linked.vmid, ip: spec.primaryIp };
      }
      throw new ValidationError(
        `IPv4 ${spec.primaryIp} is already in use on Proxmox (TG bot or another VM)`,
      );
    }
  }

  if (!vmid) {
    vmid = await client.allocateFreeVmid(node);
  }
  const templateVmid = resolveTemplateVmid(spec.os, config);
  let rootPassword = randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
  if (!needsClone && vpsRow?.rootPasswordEnc) {
    try {
      const { decrypt } = await import("../lib/crypto");
      rootPassword = decrypt(vpsRow.rootPasswordEnc);
    } catch {
      /* keep new password */
    }
  }

  const vmSpec: VmSpec = {
    vmid,
    node,
    hostname: spec.hostname,
    cores: spec.cores,
    memoryMb: spec.ramMb,
    diskGb: spec.diskGb,
    templateVmid,
    primaryIp: useStaticIp ? spec.primaryIp : undefined,
    gateway: useStaticIp ? (config.gateway ?? getProxmoxGateway()) : undefined,
    ipCidr: useStaticIp ? config.ipCidr : undefined,
    rootPassword,
    ciuser,
    storage: config.storage,
    bridge: config.bridge,
  };

  await bootVmWithCloudInit(client, node, vmid, vmSpec, config, {
    clone: needsClone,
    templateVmid,
  });

  if (needsClone || !vpsRow?.rootPasswordEnc) {
    await prisma.vpsInstance.update({
      where: { id: spec.vpsId },
      data: { rootPasswordEnc: encrypt(rootPassword), proxmoxVmid: vmid },
    });
  } else {
    await prisma.vpsInstance.update({
      where: { id: spec.vpsId },
      data: { proxmoxVmid: vmid },
    });
  }

  if (useStaticIp && spec.primaryIp) {
    const gw = spec.primaryIp ? (vmSpec.gateway ?? config.gateway ?? getProxmoxGateway()) : undefined;
    let ready = await waitGuestSshReady(node, vmid, spec.primaryIp, { ...vmSpec, os: spec.os });
    if (!ready) {
      ready = await finalizeGuestNetworkAfterBoot(node, vmid, spec.primaryIp, gw, config.ipCidr);
    }
    if (!ready) {
      // Hypervisor already has ipconfig0 from configureVm — accept without guest-agent/SSH.
      // Billing host often cannot TCP-probe the client subnet; guest-agent is optional on templates.
      try {
        const cfg = await client.getVmConfig(node, vmid);
        const configIp = client.parseIpFromConfig(cfg);
        const st = await client.getVmStatus(node, vmid).catch(() => ({ status: "" }));
        if (configIp === spec.primaryIp && st.status === "running") {
          console.warn(
            `[proxmox] ${spec.hostname} vmid=${vmid} accepting provision — ipconfig0 OK, guest-agent/SSH not required`,
          );
          ready = true;
        }
      } catch {
        /* fall through to soft error */
      }
    }
    if (!ready) {
      const templateVmid = resolveTemplateVmid(spec.os, config);
      throw new ValidationError(
        `Guest network not ready for ${spec.primaryIp} (vmid ${vmid}). Template ${templateVmid}: check ipconfig0 / cloud-init on Proxmox.`,
      );
    }
  }

  let ip: string | null = useStaticIp ? (spec.primaryIp ?? null) : null;
  if (!ip) {
    const vmConfig = await client.getVmConfig(node, vmid);
    ip = client.parseIpFromConfig(vmConfig);
  }
  if (!ip && !useStaticIp) {
    console.log(`[proxmox] optional guest-agent IP poll vmid ${vmid} (30s)...`);
    ip = await client.waitForGuestIp(node, vmid, 30_000);
  }

  if (ip) {
    await prisma.vpsInstance.update({
      where: { id: spec.vpsId },
      data: { primaryIp: ip },
    });
    console.log(`[proxmox] ${spec.hostname} vmid=${vmid} ip=${ip}`);
    return { vmid, ip };
  }

  console.warn(
    `[proxmox] ${spec.hostname} vmid=${vmid} running — IP pending (guest-agent). Queuing background sync.`,
  );
  await enqueueJob("vps.sync_ip", { vpsId: spec.vpsId }).catch(() => {});
  return { vmid, ip: "" };
}

function proxmoxVmName(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9.-]/g, "-").slice(0, 63);
}

/** Find guest VM on Proxmox by hostname (billing DB may have lost vmid). */
export async function findProxmoxVmidByHostname(
  hostname: string,
  nodeName?: string,
): Promise<{ vmid: number; node: string; name: string } | null> {
  const client = getProxmoxClient();
  if (!client) return null;
  const node = nodeName ?? getProxmoxConfig()?.node ?? "pve01";
  const expected = proxmoxVmName(hostname);
  try {
    const vms = await client.listVms(node);
    for (const vm of vms) {
      const name = vm.name ?? "";
      if (name === expected || name === hostname) {
        return { vmid: vm.vmid, node, name };
      }
    }
  } catch (e) {
    console.warn("[proxmox] list VMs failed:", e instanceof Error ? e.message : e);
  }
  return null;
}

/** Re-link VPS row to an existing VM on Proxmox (after failed reprovision). */
export async function linkVpsToProxmoxVm(vpsId: string): Promise<number | null> {
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true },
  });
  if (!vps) return null;
  if (vps.proxmoxVmid) return vps.proxmoxVmid;

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const found = await findProxmoxVmidByHostname(vps.hostname, node);
  if (!found) return null;

  await prisma.vpsInstance.update({
    where: { id: vpsId },
    data: { proxmoxVmid: found.vmid },
  });
  console.log(`[proxmox] linked ${vps.hostname} → vmid ${found.vmid} on ${found.node}`);
  return found.vmid;
}

/** Resolve and persist primary IP from guest-agent or cloud-init config. */
export async function syncVpsIpFromProxmox(vpsId: string): Promise<string | null> {
  const client = getProxmoxClient();
  const vps = await prisma.vpsInstance.findUnique({
    where: { id: vpsId },
    include: { node: true, service: true },
  });
  if (!client || !vps) return null;

  if (!vps.proxmoxVmid) {
    const linked = await linkVpsToProxmoxVm(vpsId);
    if (!linked) return null;
    vps.proxmoxVmid = linked;
  }

  const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
  const cfg = await client.getVmConfig(node, vps.proxmoxVmid);
  let ip = client.parseIpFromConfig(cfg);
  if (ip && isPlaceholderIp(ip)) ip = null;

  if (!ip) {
    ip = await client.waitForGuestIp(node, vps.proxmoxVmid, 45_000);
  }
  if (!ip) {
    const cfgRetry = await client.getVmConfig(node, vps.proxmoxVmid);
    ip = client.parseIpFromConfig(cfgRetry);
    if (ip && isPlaceholderIp(ip)) ip = null;
  }
  if (!ip) return null;

  await prisma.vpsInstance.update({
    where: { id: vpsId },
    data: { primaryIp: ip },
  });

  const st = vps.service.status;
  if (st === "REINSTALLING" || st === "PROVISIONING") {
    const { markProvisioningComplete } = await import("../core/provisioning/engine");
    await markProvisioningComplete({
      serviceId: vps.serviceId,
      idempotencyKey: `ip-sync:${vpsId}:${Date.now()}`,
      ip,
      vmid: vps.proxmoxVmid,
    }).catch((e) => console.warn("[proxmox] lifecycle after IP sync:", e));
  }

  return ip;
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
  try {
    await client.waitUntilVmidGone(node, vmid);
  } catch (err) {
    console.warn(
      `[proxmox] vmid ${vmid} destroy wait:`,
      err instanceof Error ? err.message : err,
    );
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
  const rootPassword = randomBytes(10).toString("base64url").slice(0, 16) + "A1!";
  const vmSpec = {
    vmid: newVmid,
    node,
    hostname: vps.hostname,
    cores: vps.cpuCores,
    memoryMb: vps.ramMb,
    diskGb: vps.diskGb,
    templateVmid,
    primaryIp: vps.primaryIp ?? undefined,
    gateway: config.gateway,
    ipCidr: config.ipCidr,
    rootPassword,
    ciuser: resolveProxmoxCiUser(targetOs),
    storage: config.storage,
    bridge: config.bridge,
  };

  await client.cloneFromTemplate(vmSpec);
  await client.rebuildCloudInitDrive(node, newVmid, config.storage).catch(async () => {
    await client.ensureCloudInitDrive(node, newVmid, config.storage);
  });
  await client.configureVm(vmSpec);
  await client.regenerateCloudInit(node, newVmid);
  await client.startVm(node, newVmid);

  if (vps.primaryIp) {
    const ready = await waitForVpsProvisionReady(node, newVmid, vps.primaryIp);
    if (!ready) {
      throw new ValidationError(
        `Reinstall: guest network not ready for ${vps.primaryIp} (vmid ${newVmid})`,
      );
    }
  }

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
