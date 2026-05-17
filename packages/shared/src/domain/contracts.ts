/**
 * SYSTEM CONTRACT LAYER — ownership & source of truth.
 * No subsystem may violate these boundaries.
 */

export const OWNERS = {
  PROVISIONING: "provisioning_engine",
  BILLING: "billing_engine",
  INVENTORY: "inventory_service",
  EVENT_STORE: "event_store",
  ABUSE: "abuse_engine",
  READ_MODEL: "read_model_projector",
} as const;

export type Owner = (typeof OWNERS)[keyof typeof OWNERS];

/** Single authoritative source per domain */
export const SOURCE_OF_TRUTH = {
  serviceLifecycle: OWNERS.PROVISIONING,
  invoicePayment: OWNERS.BILLING,
  nodeIpCapacity: OWNERS.INVENTORY,
  eventHistory: OWNERS.EVENT_STORE,
  riskScore: OWNERS.ABUSE,
} as const;

/** Entity → owner mapping (exactly one writer) */
export const ENTITY_OWNERSHIP = {
  Service: OWNERS.PROVISIONING,
  ProvisioningJob: OWNERS.PROVISIONING,
  ProvisioningOperation: OWNERS.PROVISIONING,
  Invoice: OWNERS.BILLING,
  Payment: OWNERS.BILLING,
  TopUp: OWNERS.BILLING,
  Transaction: OWNERS.BILLING,
  Node: OWNERS.INVENTORY,
  IpAddress: OWNERS.INVENTORY,
  VpsInstance: OWNERS.PROVISIONING,
  DomainEvent: OWNERS.EVENT_STORE,
  UserRiskProfile: OWNERS.ABUSE,
  ActivityReadModel: OWNERS.READ_MODEL,
  ServiceTimelineReadModel: OWNERS.READ_MODEL,
} as const;

export type OwnedEntity = keyof typeof ENTITY_OWNERSHIP;
