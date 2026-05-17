import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { decrypt } from "../lib/crypto";

export function resolveVpsLoginUser(os: string): string {
  const normalized = os.toLowerCase();
  if (normalized.includes("windows")) return "Administrator";
  return "root";
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

export async function getVpsAccessInfo(vpsId: string, userId: string): Promise<VpsAccessInfo> {
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
    Boolean(host);

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
