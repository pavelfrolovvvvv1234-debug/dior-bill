import { hostVdsRequest } from "./client";
import { getHostVdsNetworkRef } from "./config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

type RegionOpt = { region?: string };

/**
 * Resolve Nova flavor NAME or UUID → UUID in the active region.
 * Never trust a UUID from another region without listing.
 */
export async function resolveFlavor(nameOrUuid: string, region?: string): Promise<string> {
  const key = nameOrUuid.trim();
  const data = await hostVdsRequest<{
    flavors: Array<{ id: string; name: string }>;
  }>("/flavors/detail", { region });
  const list = Array.isArray(data.flavors) ? data.flavors : [];
  if (looksLikeUuid(key)) {
    const byId = list.find((f) => f.id === key);
    if (byId) return byId.id;
    throw new Error(`Flavor UUID ${key} not found in HostVDS region=${region ?? "default"}`);
  }
  const byName = list.find((f) => f.name === key);
  if (byName) return byName.id;
  throw new Error(
    `Flavor "${key}" not found in region=${region ?? "default"}. Available: ${list
      .map((f) => f.name)
      .slice(0, 20)
      .join(", ")}`,
  );
}

/** Resolve Glance image NAME or UUID → UUID. */
export async function resolveImage(nameOrUuid: string, region?: string): Promise<string> {
  const key = nameOrUuid.trim();
  const data = await hostVdsRequest<{
    images: Array<{ id: string; name: string }>;
  }>("/v2/images?limit=200", { service: "image", region });
  const list = Array.isArray(data.images) ? data.images : [];
  if (looksLikeUuid(key)) {
    const byId = list.find((i) => i.id === key);
    if (byId) return byId.id;
    throw new Error(`Image UUID ${key} not found in HostVDS region=${region ?? "default"}`);
  }
  const byName = list.find((i) => i.name === key);
  if (byName) return byName.id;
  throw new Error(
    `Image "${key}" not found in region=${region ?? "default"}. Available: ${list
      .map((i) => i.name)
      .slice(0, 20)
      .join(", ")}`,
  );
}

/**
 * Resolve Neutron network NAME or UUID → UUID.
 * If the configured name is missing in this region, fall back to first `Internet-NN`.
 */
export async function resolveNetwork(
  nameOrUuid: string = getHostVdsNetworkRef(),
  region?: string,
): Promise<string> {
  const key = nameOrUuid.trim();
  const data = await hostVdsRequest<{
    networks: Array<{ id: string; name: string }>;
  }>("/v2.0/networks", { service: "network", region });
  const list = Array.isArray(data.networks) ? data.networks : [];
  if (looksLikeUuid(key)) {
    const byId = list.find((n) => n.id === key);
    if (byId) return byId.id;
    throw new Error(`Network UUID ${key} not found in HostVDS region=${region ?? "default"}`);
  }
  const byName = list.find((n) => n.name === key);
  if (byName) return byName.id;

  const fallback =
    list.find((n) => /^Internet-\d+$/i.test(n.name)) ??
    list.find((n) => /^Internet-/i.test(n.name) && !/ipv6/i.test(n.name));
  if (fallback) return fallback.id;

  throw new Error(
    `Network "${key}" not found in region=${region ?? "default"}. Available: ${list
      .map((n) => n.name)
      .slice(0, 20)
      .join(", ")}`,
  );
}

/** Ensure security group name exists (best-effort warn via throw). */
export async function assertSecurityGroupExists(
  name: string,
  region?: string,
): Promise<void> {
  const data = await hostVdsRequest<{
    security_groups: Array<{ id: string; name: string }>;
  }>("/v2.0/security-groups", { service: "network", region });
  const list = Array.isArray(data.security_groups) ? data.security_groups : [];
  if (!list.some((sg) => sg.name === name)) {
    throw new Error(
      `Security group "${name}" not found in region=${region ?? "default"}. Available: ${list.map((s) => s.name).join(", ")}`,
    );
  }
}

export type { RegionOpt };
