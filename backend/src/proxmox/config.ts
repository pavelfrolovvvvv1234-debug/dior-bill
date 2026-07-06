export type ProxmoxRuntimeConfig = {
  apiUrl: string;
  tokenId: string;
  tokenSecret: string;
  node: string;
  storage: string;
  bridge: string;
  gateway?: string;
  ipCidr: number;
  /** Accept self-signed / private CA certs (default for Proxmox). */
  insecureTls: boolean;
  caCertPath?: string;
  templateMap: Record<string, number>;
};

/** Proxmox clusters almost always use self-signed certs unless you install a real CA. */
export function parseProxmoxInsecureTls(): boolean {
  const insecure = process.env.PROXMOX_INSECURE_TLS?.trim().toLowerCase();
  if (insecure === "1" || insecure === "true" || insecure === "yes") return true;
  if (insecure === "0" || insecure === "false" || insecure === "no") return false;

  const verify = process.env.PROXMOX_VERIFY_TLS?.trim().toLowerCase();
  if (verify === "1" || verify === "true" || verify === "yes") return false;

  return true;
}

export function proxmoxTlsHint(errorMessage: string): string | null {
  if (!/unable to verify the first certificate|self[- ]signed certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(errorMessage)) {
    return null;
  }
  return "Proxmox uses a self-signed TLS cert. Set PROXMOX_INSECURE_TLS=1 in .env (or PROXMOX_CA_CERT_PATH) and restart dior-worker.";
}

function parseTemplateMap(raw: string | undefined): Record<string, number> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number | string>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k.toLowerCase()] = typeof v === "number" ? v : Number(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function getProxmoxConfig(): ProxmoxRuntimeConfig | null {
  const apiUrl =
    process.env.PROXMOX_BASE_URL?.trim() ||
    process.env.PROXMOX_API_URL?.trim() ||
    "";
  const tokenId = process.env.PROXMOX_TOKEN_ID?.trim() || "";
  const tokenSecret =
    process.env.PROXMOX_TOKEN_SECRET?.trim() ||
    process.env.PROXMOX_API_TOKEN?.trim() ||
    "";

  if (!apiUrl || !tokenId || !tokenSecret) return null;

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    tokenId,
    tokenSecret,
    node: process.env.PROXMOX_NODE?.trim() || "pve01",
    storage: process.env.PROXMOX_STORAGE?.trim() || "local-lvm",
    bridge: process.env.PROXMOX_BRIDGE?.trim() || "vmbr0",
    gateway: process.env.PROXMOX_GATEWAY?.trim() || undefined,
    ipCidr: (() => {
      const raw = process.env.PROXMOX_IP_CIDR?.trim();
      const n = raw ? Number.parseInt(raw, 10) : 24;
      return Number.isFinite(n) && n > 0 && n <= 32 ? n : 24;
    })(),
    insecureTls: parseProxmoxInsecureTls(),
    caCertPath: process.env.PROXMOX_CA_CERT_PATH?.trim() || undefined,
    templateMap: parseTemplateMap(process.env.PROXMOX_TEMPLATE_MAP),
  };
}

export function isProxmoxConfigured(): boolean {
  return getProxmoxConfig() !== null;
}

/** Cloud-init login user pushed to Proxmox (must match Access credentials username). */
export function getProxmoxCiUser(): string {
  return process.env.PROXMOX_CIUSER?.trim() || "root";
}

/** Cloud-init login user (default root — matches Proxmox templates on this cluster). */
export function resolveProxmoxCiUser(os: string): string {
  if (os.trim().toLowerCase().includes("windows")) return "Administrator";
  return getProxmoxCiUser();
}
