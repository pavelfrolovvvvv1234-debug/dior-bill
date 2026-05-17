import { ROLES } from "./constants";

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

/** Granular control-plane permissions */
export const CONTROL_PERMISSIONS = [
  "users.read",
  "users.write",
  "users.impersonate",
  "services.read",
  "services.write",
  "billing.read",
  "billing.write",
  "payments.read",
  "payments.write",
  "referrals.read",
  "referrals.write",
  "promo.read",
  "promo.write",
  "infrastructure.read",
  "infrastructure.write",
  "support.read",
  "support.write",
  "security.read",
  "security.write",
  "audit.read",
  "analytics.read",
  "notifications.write",
  "settings.write",
] as const;

export type ControlPermission = (typeof CONTROL_PERMISSIONS)[number];

const ALL = new Set<ControlPermission>(CONTROL_PERMISSIONS);

const SUPPORT: ControlPermission[] = [
  "users.read",
  "services.read",
  "billing.read",
  "payments.read",
  "support.read",
  "support.write",
  "audit.read",
];

const OPERATOR: ControlPermission[] = [
  ...SUPPORT,
  "infrastructure.read",
  "infrastructure.write",
  "services.write",
  "security.read",
];

const BILLING: ControlPermission[] = [
  "users.read",
  "billing.read",
  "billing.write",
  "payments.read",
  "payments.write",
  "referrals.read",
  "referrals.write",
  "promo.read",
  "promo.write",
  "audit.read",
  "analytics.read",
];

const ADMIN: ControlPermission[] = [
  ...OPERATOR,
  ...BILLING,
  "users.write",
  "referrals.write",
  "promo.write",
  "notifications.write",
  "analytics.read",
  "security.write",
];

const OWNER: ControlPermission[] = [...ALL];

export const ROLE_PERMISSIONS: Record<UserRole, ControlPermission[]> = {
  USER: [],
  AFFILIATE_VIP: [],
  SUPPORT: SUPPORT,
  OPERATOR: OPERATOR,
  ADMIN: ADMIN,
  SUPER_ADMIN: OWNER,
};

export function hasPermission(role: UserRole, permission: ControlPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionDeniedMessage(permission: ControlPermission): string {
  return `Missing permission: ${permission}`;
}
