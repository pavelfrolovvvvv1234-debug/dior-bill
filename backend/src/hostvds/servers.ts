import { hostVdsListComputeRegions, hostVdsRequest, HostVdsApiError } from "./client";
import { getHostVdsPollIntervalMs, getHostVdsProvisionTimeoutMs, getHostVdsSecurityGroups } from "./config";
import type { HostVdsCreateServerInput, HostVdsServer } from "./types";

type NovaAddressEntry = { addr?: string; version?: number };
type NovaServerRaw = {
  id: string;
  name: string;
  status: string;
  adminPass?: string;
  metadata?: Record<string, string>;
  addresses?: Record<string, NovaAddressEntry[]>;
  accessIPv4?: string;
};

export type HostVdsRegionOpt = { region?: string };

function extractAddresses(raw: NovaServerRaw): string[] {
  const out: string[] = [];
  if (raw.accessIPv4 && /^\d+\.\d+\.\d+\.\d+$/.test(raw.accessIPv4)) {
    out.push(raw.accessIPv4);
  }
  if (raw.addresses) {
    for (const list of Object.values(raw.addresses)) {
      for (const entry of list ?? []) {
        const addr = entry.addr?.trim();
        if (addr && entry.version === 4 && /^\d+\.\d+\.\d+\.\d+$/.test(addr)) {
          out.push(addr);
        }
      }
    }
  }
  return [...new Set(out)];
}

function mapServer(raw: NovaServerRaw): HostVdsServer {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status || "UNKNOWN",
    addresses: extractAddresses(raw),
    adminPass: raw.adminPass,
    metadata: raw.metadata,
  };
}

/**
 * Create server ONCE — never wrap this in a retry loop.
 * On network timeout, caller must recover via hostVdsFindServerByVpsId, not re-POST.
 */
export async function hostVdsCreateServer(
  input: HostVdsCreateServerInput & HostVdsRegionOpt,
): Promise<HostVdsServer> {
  const securityGroups = (input.securityGroups?.length
    ? input.securityGroups
    : getHostVdsSecurityGroups()
  ).map((name) => ({ name }));

  const body = {
    server: {
      name: input.name,
      imageRef: input.imageRef,
      flavorRef: input.flavorRef,
      networks: [{ uuid: input.networkId }],
      adminPass: input.adminPass,
      user_data: input.userData,
      security_groups: securityGroups,
      // Never put passwords in metadata — readable via Nova API.
      metadata: { ...(input.metadata ?? {}) },
    },
  };

  const data = await hostVdsRequest<{ server: NovaServerRaw }>("/servers", {
    method: "POST",
    body,
    region: input.region,
  });
  return mapServer(data.server);
}

export async function hostVdsGetServer(
  serverId: string,
  opts?: HostVdsRegionOpt,
): Promise<HostVdsServer> {
  const data = await hostVdsRequest<{ server: NovaServerRaw }>(
    `/servers/${encodeURIComponent(serverId)}`,
    { region: opts?.region },
  );
  return mapServer(data.server);
}

/** Find an existing server by our billing metadata (idempotent create recovery). */
export async function hostVdsFindServerByVpsId(
  vpsId: string,
  opts?: HostVdsRegionOpt,
): Promise<HostVdsServer | null> {
  const tryRegion = async (region?: string) => {
    const data = await hostVdsRequest<{ servers: NovaServerRaw[] }>("/servers/detail", {
      region,
    });
    const list = Array.isArray(data.servers) ? data.servers : [];
    const hit = list.find((s) => s.metadata?.dior_vps_id === vpsId);
    return hit ? mapServer(hit) : null;
  };

  try {
    if (opts?.region) {
      return await tryRegion(opts.region);
    }
    const hit = await tryRegion();
    if (hit) return hit;
    // Rare: create timed out before we knew region — scan other compute regions.
    const regions = await hostVdsListComputeRegions();
    for (const region of regions) {
      const found = await tryRegion(region).catch(() => null);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

export async function hostVdsDeleteServer(
  serverId: string,
  opts?: HostVdsRegionOpt,
): Promise<void> {
  try {
    await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}`, {
      method: "DELETE",
      region: opts?.region,
    });
  } catch (err) {
    if (err instanceof HostVdsApiError && err.statusCode === 404) return;
    if (err instanceof Error && /not found|itemNotFound/i.test(err.message)) return;
    throw err;
  }
}

export async function hostVdsRebootServer(
  serverId: string,
  type: "SOFT" | "HARD" = "SOFT",
  opts?: HostVdsRegionOpt,
): Promise<void> {
  await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}/action`, {
    method: "POST",
    body: { reboot: { type } },
    region: opts?.region,
  });
}

export async function hostVdsStartServer(
  serverId: string,
  opts?: HostVdsRegionOpt,
): Promise<void> {
  await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}/action`, {
    method: "POST",
    body: { "os-start": null },
    region: opts?.region,
  });
}

export async function hostVdsStopServer(
  serverId: string,
  opts?: HostVdsRegionOpt,
): Promise<void> {
  await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}/action`, {
    method: "POST",
    body: { "os-stop": null },
    region: opts?.region,
  });
}

export async function hostVdsRebuildServer(
  serverId: string,
  imageRef: string,
  adminPass: string,
  userData?: string,
  opts?: HostVdsRegionOpt,
): Promise<void> {
  await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}/action`, {
    method: "POST",
    body: {
      rebuild: {
        imageRef,
        adminPass,
        ...(userData ? { user_data: userData } : {}),
      },
    },
    region: opts?.region,
  });
}

export async function hostVdsChangePassword(
  serverId: string,
  adminPass: string,
  opts?: HostVdsRegionOpt,
): Promise<void> {
  await hostVdsRequest(`/servers/${encodeURIComponent(serverId)}/action`, {
    method: "POST",
    body: { changePassword: { adminPass } },
    region: opts?.region,
  });
}

/** Poll until ACTIVE / ERROR or timeout. Retry-safe (GET only). */
export async function hostVdsWaitForServer(
  serverId: string,
  opts?: HostVdsRegionOpt & { timeoutMs?: number; intervalMs?: number },
): Promise<HostVdsServer> {
  const timeoutMs = opts?.timeoutMs ?? getHostVdsProvisionTimeoutMs();
  const intervalMs = opts?.intervalMs ?? getHostVdsPollIntervalMs();
  const deadline = Date.now() + timeoutMs;
  let last: HostVdsServer | null = null;

  while (Date.now() < deadline) {
    last = await hostVdsGetServer(serverId, { region: opts?.region });
    const status = last.status.toUpperCase();
    if (status === "ACTIVE") return last;
    if (status === "ERROR" || status === "DELETED") {
      throw new Error(`HostVDS server entered ${status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `HostVDS server ${serverId} not ACTIVE in time (last=${last?.status ?? "unknown"})`,
  );
}
