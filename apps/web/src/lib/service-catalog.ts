import type { ServiceStatus, ServiceType } from "@dior/database";

export type ServiceFilter = "all" | "active" | "provisioning" | "inactive";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  VPS: "VPS / VDS",
  DEDICATED: "Dedicated servers",
  DOMAIN: "Domains",
  CDN: "CDN",
};

export const SERVICE_TYPE_ORDER: ServiceType[] = ["VPS", "DEDICATED", "DOMAIN", "CDN"];

export type ServiceRow = {
  id: string;
  type: ServiceType;
  status: ServiceStatus;
  name: string;
  detail: string;
  region: string;
  plan: string;
  renewsAt: Date | null;
  manageHref: string;
  isActive: boolean;
  vpsId?: string;
  canRenew: boolean;
  canUpgrade: boolean;
};

const RENEWABLE_STATUSES: ServiceStatus[] = ["ACTIVE", "SUSPENDED", "EXPIRED"];

type RawService = {
  id: string;
  type: ServiceType;
  status: ServiceStatus;
  label: string;
  renewsAt: Date | null;
  vpsInstance?: {
    id: string;
    hostname: string;
    primaryIp: string | null;
    os: string;
    cpuCores: number;
    ramMb: number;
    diskGb: number;
    location?: { name: string } | null;
  } | null;
  dedicatedServer?: {
    id: string;
    hostname: string;
    primaryIp: string | null;
    uplink: string | null;
    location?: { name: string } | null;
    inventory?: { name: string; cpu: string } | null;
  } | null;
  domain?: { id: string; domainName: string; registrar: string } | null;
  cdnZone?: { zoneName: string; bandwidthGb: number } | null;
};

export function toServiceRow(service: RawService): ServiceRow {
  const activeStatuses: ServiceStatus[] = ["ACTIVE"];
  const provisioningStatuses: ServiceStatus[] = [
    "PENDING",
    "PROVISIONING",
    "REINSTALLING",
    "SNAPSHOTTING",
    "ROLLBACK",
  ];

  let name = service.label;
  let detail = "—";
  let region = "—";
  let plan = "—";
  let manageHref = "/services";

  if (service.vpsInstance) {
    const v = service.vpsInstance;
    name = v.hostname;
    detail = v.primaryIp ?? "Provisioning";
    region = v.location?.name ?? "—";
    plan = `${v.cpuCores} vCPU · ${v.ramMb / 1024} GB · ${v.diskGb} GB`;
    manageHref = `/vps/${v.id}`;
  } else if (service.dedicatedServer) {
    const d = service.dedicatedServer;
    name = d.hostname;
    detail = d.primaryIp ?? "Pending IP";
    region = d.location?.name ?? "—";
    plan = d.inventory?.name ?? d.uplink ?? "Dedicated";
    manageHref = `/services?type=dedicated&id=${service.id}`;
  } else if (service.domain) {
    name = service.domain.domainName;
    detail = service.domain.registrar;
    plan = "Registration";
    manageHref = `/domains/${service.domain.id}`;
  } else if (service.cdnZone) {
    const z = service.cdnZone;
    name = z.zoneName;
    detail = `${z.bandwidthGb.toFixed(1)} GB bandwidth`;
    plan = "Edge delivery";
    manageHref = `/services?type=cdn&id=${service.id}`;
  }

  const isActive =
    activeStatuses.includes(service.status) ||
    provisioningStatuses.includes(service.status);

  const canRenew = RENEWABLE_STATUSES.includes(service.status);
  const canUpgrade = service.type === "VPS" && service.status === "ACTIVE" && !!service.vpsInstance;

  return {
    id: service.id,
    type: service.type,
    status: service.status,
    name,
    detail,
    region,
    plan,
    renewsAt: service.renewsAt,
    manageHref,
    isActive,
    vpsId: service.vpsInstance?.id,
    canRenew,
    canUpgrade,
  };
}

export function filterServices(rows: ServiceRow[], filter: ServiceFilter): ServiceRow[] {
  if (filter === "all") return rows;
  if (filter === "active") {
    return rows.filter((r) => r.status === "ACTIVE");
  }
  if (filter === "provisioning") {
    return rows.filter((r) =>
      ["PENDING", "PROVISIONING", "REINSTALLING", "SNAPSHOTTING", "ROLLBACK"].includes(r.status),
    );
  }
  return rows.filter((r) =>
    ["SUSPENDED", "EXPIRED", "CANCELLED", "FAILED", "DELETED"].includes(r.status),
  );
}

export function sortServices(rows: ServiceRow[]): ServiceRow[] {
  const rank = (s: ServiceStatus) => {
    if (s === "ACTIVE") return 0;
    if (["PROVISIONING", "PENDING", "REINSTALLING"].includes(s)) return 1;
    if (s === "SUSPENDED") return 2;
    if (s === "EXPIRED") return 3;
    return 4;
  };
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}

export function groupServicesByType(rows: ServiceRow[]): Map<ServiceType, ServiceRow[]> {
  const map = new Map<ServiceType, ServiceRow[]>();
  for (const type of SERVICE_TYPE_ORDER) {
    const group = rows.filter((r) => r.type === type);
    if (group.length) map.set(type, group);
  }
  return map;
}

export function statusLabel(status: ServiceStatus): string {
  const labels: Partial<Record<ServiceStatus, string>> = {
    ACTIVE: "Active",
    PROVISIONING: "Provisioning",
    PENDING: "Pending",
    SUSPENDED: "Suspended",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    DELETED: "Deleted",
  };
  return labels[status] ?? status;
}
