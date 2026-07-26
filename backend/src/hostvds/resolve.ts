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

/**
 * Ensure an open security group exists in the region (SSH/22 must work).
 * Creates `allow_all` + wide ingress when missing; otherwise falls back to default.
 */
export async function resolveSecurityGroups(
  preferred: string[] = [],
  region?: string,
): Promise<string[]> {
  const listGroups = async () => {
    const data = await hostVdsRequest<{
      security_groups: Array<{ id: string; name: string }>;
    }>("/v2.0/security-groups", { service: "network", region });
    return Array.isArray(data.security_groups) ? data.security_groups : [];
  };

  let list = await listGroups();
  if (list.length === 0) {
    throw new Error(`No security groups in HostVDS region=${region ?? "default"}`);
  }

  const pick = (names: string[]): string | null => {
    const byName = new Map(list.map((sg) => [sg.name, sg.name]));
    for (const name of names) {
      const hit = byName.get(name);
      if (hit) return hit;
    }
    return null;
  };

  const preferredHit = pick(preferred.length ? preferred : ["allow_all"]);
  if (preferredHit) return [preferredHit];

  // Create project-local allow_all in this region (HostVDS often only ships `default`).
  if (!pick(["allow_all"])) {
    try {
      const created = await hostVdsRequest<{
        security_group: { id: string; name: string };
      }>("/v2.0/security-groups", {
        method: "POST",
        service: "network",
        region,
        body: {
          security_group: {
            name: "allow_all",
            description: "dior-billing open ingress (auto-created)",
          },
        },
      });
      const sgId = created.security_group?.id;
      if (sgId) {
        const ruleBodies = [
          {
            direction: "ingress",
            ethertype: "IPv4",
            remote_ip_prefix: "0.0.0.0/0",
            security_group_id: sgId,
          },
          {
            direction: "ingress",
            ethertype: "IPv6",
            remote_ip_prefix: "::/0",
            security_group_id: sgId,
          },
          {
            direction: "ingress",
            ethertype: "IPv4",
            protocol: "tcp",
            port_range_min: 1,
            port_range_max: 65535,
            remote_ip_prefix: "0.0.0.0/0",
            security_group_id: sgId,
          },
          {
            direction: "ingress",
            ethertype: "IPv4",
            protocol: "udp",
            port_range_min: 1,
            port_range_max: 65535,
            remote_ip_prefix: "0.0.0.0/0",
            security_group_id: sgId,
          },
          {
            direction: "ingress",
            ethertype: "IPv4",
            protocol: "icmp",
            remote_ip_prefix: "0.0.0.0/0",
            security_group_id: sgId,
          },
        ];
        for (const rule of ruleBodies) {
          await hostVdsRequest("/v2.0/security-group-rules", {
            method: "POST",
            service: "network",
            region,
            body: { security_group_rule: rule },
          }).catch(() => undefined);
        }
      }
      list = await listGroups();
      const createdName = pick(["allow_all"]);
      if (createdName) return [createdName];
    } catch (err) {
      console.warn(
        `[hostvds] could not create allow_all in region=${region ?? "default"}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const fallback = pick(["allow_all", "default"]) ?? list[0]!.name;
  return [fallback];
}

/** @deprecated use resolveSecurityGroups */
export async function assertSecurityGroupExists(
  name: string,
  region?: string,
): Promise<void> {
  await resolveSecurityGroups([name], region);
}

export type { RegionOpt };
