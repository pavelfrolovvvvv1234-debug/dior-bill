export const APP_NAME = "Dior Cloud";
export const APP_TAGLINE = "Abuse-resistant infrastructure";

export const ROLES = {
  USER: "USER",
  AFFILIATE_VIP: "AFFILIATE_VIP",
  SUPPORT: "SUPPORT",
  OPERATOR: "OPERATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export const ADMIN_ROLES = ["SUPPORT", "OPERATOR", "ADMIN", "SUPER_ADMIN"] as const;

export const DEFAULT_REFERRAL_PERCENT = 5;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, max: 10 },
  API: { windowMs: 60 * 1000, max: 120 },
  REGISTER: { windowMs: 60 * 60 * 1000, max: 5 },
} as const;

export const NOTIFICATION_TYPES = {
  BILLING: "billing",
  INFRASTRUCTURE: "infrastructure",
  DEPLOYMENT: "deployment",
  REFERRAL: "referral",
  INCIDENT: "incident",
  RENEWAL: "renewal",
} as const;

export const INFRA_FEED_TYPES = {
  NODE: "node",
  LOCATION: "location",
  NETWORK: "network",
  DDOS: "ddos",
  UPSTREAM: "upstream",
  MAINTENANCE: "maintenance",
  INCIDENT: "incident",
  STOCK: "stock",
} as const;
