export type ProxmoxRuntimeConfig = {
  apiUrl: string;
  tokenId: string;
  tokenSecret: string;
  node: string;
  storage: string;
  bridge: string;
  verifyTls: boolean;
  templateMap: Record<string, number>;
};

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
    verifyTls: process.env.PROXMOX_INSECURE_TLS !== "1",
    templateMap: parseTemplateMap(process.env.PROXMOX_TEMPLATE_MAP),
  };
}

export function isProxmoxConfigured(): boolean {
  return getProxmoxConfig() !== null;
}
