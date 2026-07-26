import { hostVdsRequest } from "./client";
import { getHostVdsNetworkRef } from "./config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

type SgRow = {
  id: string;
  name: string;
  security_group_rules?: Array<{
    direction?: string;
    protocol?: string | null;
    port_range_min?: number | null;
    port_range_max?: number | null;
    remote_ip_prefix?: string | null;
  }>;
};

async function listSecurityGroups(region?: string): Promise<SgRow[]> {
  const data = await hostVdsRequest<{ security_groups: SgRow[] }>(
    "/v2.0/security-groups",
    { service: "network", region },
  );
  return Array.isArray(data.security_groups) ? data.security_groups : [];
}

function hasOpenSshIngress(sg: SgRow): boolean {
  const rules = sg.security_group_rules ?? [];
  return rules.some((r) => {
    if (r.direction !== "ingress") return false;
    const proto = (r.protocol ?? "").toLowerCase();
    const prefix = r.remote_ip_prefix ?? "";
    const openNet = prefix === "0.0.0.0/0" || prefix === "::/0" || prefix === "";
    if (!openNet && prefix) return false;
    // Any protocol / null = all traffic
    if (!proto || proto === "null") return true;
    if (proto === "tcp") {
      const min = r.port_range_min ?? 1;
      const max = r.port_range_max ?? 65535;
      return min <= 22 && max >= 22;
    }
    return false;
  });
}

async function addOpenIngressRules(sgId: string, region?: string): Promise<void> {
  const ruleBodies = [
    {
      direction: "ingress",
      ethertype: "IPv4",
      protocol: "tcp",
      port_range_min: 22,
      port_range_max: 22,
      remote_ip_prefix: "0.0.0.0/0",
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
    {
      direction: "ingress",
      ethertype: "IPv4",
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

async function ensureOpenIngress(sg: SgRow, region?: string): Promise<void> {
  if (hasOpenSshIngress(sg)) return;
  console.warn(
    `[hostvds] SG "${sg.name}" has no open SSH ingress in region=${region ?? "default"} — adding rules`,
  );
  await addOpenIngressRules(sg.id, region);
}

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
 * Pick/create a security group that actually allows SSH (TCP/22).
 * Prefer allow_all; otherwise open ingress on `default` — never ship a closed SG.
 */
export async function resolveSecurityGroups(
  preferred: string[] = [],
  region?: string,
): Promise<string[]> {
  let list = await listSecurityGroups(region);
  if (list.length === 0) {
    throw new Error(`No security groups in HostVDS region=${region ?? "default"}`);
  }

  const find = (name: string) => list.find((sg) => sg.name === name) ?? null;

  // 1) Create allow_all if missing
  if (!find("allow_all")) {
    try {
      await hostVdsRequest<{ security_group: { id: string; name: string } }>(
        "/v2.0/security-groups",
        {
          method: "POST",
          service: "network",
          region,
          body: {
            security_group: {
              name: "allow_all",
              description: "dior-billing open ingress (auto-created)",
            },
          },
        },
      );
      list = await listSecurityGroups(region);
    } catch (err) {
      console.warn(
        `[hostvds] could not create allow_all in region=${region ?? "default"}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const candidates = [
    ...preferred,
    "allow_all",
    "default",
    ...list.map((sg) => sg.name),
  ];
  const tried = new Set<string>();

  for (const name of candidates) {
    if (!name || tried.has(name)) continue;
    tried.add(name);
    const sg = find(name);
    if (!sg) continue;
    await ensureOpenIngress(sg, region);
    // re-fetch to confirm
    list = await listSecurityGroups(region);
    const refreshed = list.find((s) => s.id === sg.id) ?? sg;
    if (hasOpenSshIngress(refreshed)) {
      return [refreshed.name];
    }
    console.warn(
      `[hostvds] SG "${name}" still closed after rule update in region=${region ?? "default"}`,
    );
  }

  throw new Error(
    `No HostVDS security group with open SSH in region=${region ?? "default"}. Available: ${list
      .map((s) => s.name)
      .join(", ")}`,
  );
}

/** @deprecated use resolveSecurityGroups */
export async function assertSecurityGroupExists(
  name: string,
  region?: string,
): Promise<void> {
  await resolveSecurityGroups([name], region);
}
