import { NotFoundError } from "@dior/shared";
import { decrypt } from "../lib/crypto";
import { getProxmoxClient, getProxmoxNodeName } from "../proxmox/client";
import { getProxmoxCiUser, isProxmoxConfigured } from "../proxmox/config";

function isFakeDemoIp(address: string): boolean {
  const ip = address.trim();
  return ip.startsWith("185.234.") || /^10\.0\.\d+\.\d+$/.test(ip);
}

export function resolveVpsLoginUser(os: string): string {
  if (os.toLowerCase().includes("windows")) return "Administrator";
  return getProxmoxCiUser();
}

export function formatVpsOsLabel(os: string): string {
  return os
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/V(\d)/i, "v$1");
}

export function isWindowsVpsOs(os: string): boolean {
  return os.toLowerCase().includes("windows");
}

export type VpsAccessInfo = {
  username: string;
  password: string | null;
  host: string | null;
  sshPort: number;
  sshCommand: string | null;
  rdpTarget: string | null;
  proxmoxVmid: number | null;
  serviceStatus: string;
  rescueMode: boolean;
  canManage: boolean;
};

export type VpsCredentialValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  hostname: string;
  serviceStatus: string;
  access: {
    username: string;
    host: string | null;
    hasPassword: boolean;
    sshCommand: string | null;
    proxmoxVmid: number | null;
  };
};

type VpsCredentialRow = {
  hostname: string;
  os: string;
  primaryIp: string | null;
  proxmoxVmid: number | null;
  rootPasswordEnc: string | null;
  service: { status: string };
  node: { proxmoxNode: string | null; name: string } | null;
};

/** Pure checks on billing DB fields required for SSH/RDP login. */
export function assessVpsCredentialFields(vps: VpsCredentialRow): {
  errors: string[];
  warnings: string[];
  password: string | null;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let password: string | null = null;

  if (vps.service.status !== "ACTIVE") {
    warnings.push(`Service status is ${vps.service.status} (credentials shown after ACTIVE)`);
  }

  if (!vps.primaryIp) {
    errors.push("primaryIp is missing");
  } else if (isFakeDemoIp(vps.primaryIp)) {
    errors.push(`primaryIp is a demo placeholder (${vps.primaryIp})`);
  } else if (!/^\d+\.\d+\.\d+\.\d+$/.test(vps.primaryIp)) {
    errors.push(`primaryIp is not a valid IPv4 (${vps.primaryIp})`);
  }

  if (!vps.proxmoxVmid) {
    errors.push("proxmoxVmid is missing — VM not linked");
  }

  if (!vps.rootPasswordEnc) {
    errors.push("rootPasswordEnc is missing — no login password in billing");
  } else {
    try {
      password = decrypt(vps.rootPasswordEnc);
      if (password.length < 8) {
        warnings.push("Stored password is shorter than 8 characters");
      }
    } catch {
      errors.push("rootPasswordEnc cannot be decrypted — check ENCRYPTION_KEY on web and worker");
    }
  }

  return { errors, warnings, password };
}

/** Validate billing + Proxmox data needed to log in to a purchased VPS. */
export async function validateVpsBillingCredentials(
  vpsId: string,
  userId?: string,
): Promise<VpsCredentialValidation> {
  const { prisma } = await import("@dior/database");
  const vps = await prisma.vpsInstance.findFirst({
    where: {
      id: vpsId,
      ...(userId ? { service: { userId } } : {}),
    },
    include: { service: true, node: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");

  const { errors, warnings, password } = assessVpsCredentialFields(vps);
  const username = resolveVpsLoginUser(vps.os);
  const host = vps.primaryIp;

  if (isProxmoxConfigured() && vps.proxmoxVmid) {
    const client = getProxmoxClient();
    const node = getProxmoxNodeName(vps.node?.proxmoxNode ?? vps.node?.name);
    if (client) {
      try {
        const cfg = await client.getVmConfig(node, vps.proxmoxVmid);
        const pveIp = client.parseIpFromConfig(cfg);
        if (pveIp && host && pveIp !== host) {
          errors.push(`IP mismatch: billing=${host}, Proxmox ipconfig0=${pveIp}`);
        }
        if (host && !pveIp) {
          warnings.push("Proxmox ipconfig0 empty — IP may apply after cloud-init first boot");
        }
        const ciuser = cfg.ciuser?.trim();
        if (ciuser && ciuser !== username) {
          warnings.push(`Proxmox ciuser=${ciuser} but billing shows username=${username}`);
        }
        if (!cfg.ipconfig0 && host) {
          warnings.push("No ipconfig0 on VM — static IP may not be applied yet");
        }
      } catch (e) {
        warnings.push(
          `Could not read Proxmox VM config: ${e instanceof Error ? e.message : "unknown"}`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    hostname: vps.hostname,
    serviceStatus: vps.service.status,
    access: {
      username,
      host,
      hasPassword: Boolean(password),
      sshCommand: host && !isWindowsVpsOs(vps.os) ? `ssh ${username}@${host}` : null,
      proxmoxVmid: vps.proxmoxVmid,
    },
  };
}

export async function getVpsAccessInfo(vpsId: string, userId: string): Promise<VpsAccessInfo> {
  const { prisma } = await import("@dior/database");
  const vps = await prisma.vpsInstance.findFirst({
    where: { id: vpsId, service: { userId } },
    include: { service: true },
  });
  if (!vps) throw new NotFoundError("VPS not found");
  const username = resolveVpsLoginUser(vps.os);
  const host = vps.primaryIp;

  let password: string | null = null;
  if (vps.rootPasswordEnc) {
    try {
      password = decrypt(vps.rootPasswordEnc);
    } catch {
      password = null;
    }
  }

  const canManage =
    vps.service.status === "ACTIVE" &&
    Boolean(vps.proxmoxVmid) &&
    Boolean(host) &&
    Boolean(password);

  return {
    username,
    password,
    host,
    sshPort: 22,
    sshCommand: host && !isWindowsVpsOs(vps.os) ? `ssh ${username}@${host}` : null,
    rdpTarget: host && isWindowsVpsOs(vps.os) ? host : null,
    proxmoxVmid: vps.proxmoxVmid,
    serviceStatus: vps.service.status,
    rescueMode: vps.rescueMode,
    canManage,
  };
}
