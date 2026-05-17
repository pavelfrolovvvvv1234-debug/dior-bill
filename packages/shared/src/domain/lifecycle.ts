/**
 * Provisioning lifecycle FSM — HARD CONTRACT.
 * Only ProvisioningEngine may apply transitions.
 */

export const SERVICE_LIFECYCLE = {
  PENDING: "PENDING",
  PROVISIONING: "PROVISIONING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
  FAILED: "FAILED",
  ROLLBACK: "ROLLBACK",
  REINSTALLING: "REINSTALLING",
  SNAPSHOTTING: "SNAPSHOTTING",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;

export type ServiceLifecycleState =
  (typeof SERVICE_LIFECYCLE)[keyof typeof SERVICE_LIFECYCLE];

/** Allowed transitions: from → to[] */
export const LIFECYCLE_TRANSITIONS: Record<ServiceLifecycleState, ServiceLifecycleState[]> = {
  PENDING: ["PROVISIONING", "FAILED", "CANCELLED", "DELETED"],
  PROVISIONING: ["ACTIVE", "FAILED", "ROLLBACK", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "REINSTALLING", "SNAPSHOTTING", "DELETED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "DELETED", "CANCELLED"],
  FAILED: ["PENDING", "ROLLBACK", "DELETED", "CANCELLED"],
  ROLLBACK: ["PENDING", "FAILED", "DELETED"],
  REINSTALLING: ["ACTIVE", "FAILED", "PROVISIONING"],
  SNAPSHOTTING: ["ACTIVE", "FAILED"],
  DELETED: [],
  CANCELLED: [],
  EXPIRED: ["ACTIVE", "DELETED", "CANCELLED"],
};

export function canTransition(
  from: ServiceLifecycleState,
  to: ServiceLifecycleState,
): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ServiceLifecycleState,
  to: ServiceLifecycleState,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lifecycle transition: ${from} → ${to}`);
  }
}
