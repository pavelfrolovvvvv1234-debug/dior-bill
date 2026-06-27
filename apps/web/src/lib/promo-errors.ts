import { isNextProductionDigestError } from "@/lib/server-action-error";

const PROMO_ERROR_KEYS: Record<string, string> = {
  "Enter a promo code": "promo.enterCode",
  "Invalid promo code": "promo.invalid",
  "Promo code exhausted": "promo.exhausted",
  "Promo not yet valid": "promo.notYetValid",
  "Promo expired": "promo.expired",
  "Promo code has no value": "promo.noValue",
  "You have already used this promo code": "promo.alreadyUsed",
  "This promo code applies at checkout when placing an order":
    "promo.checkoutOnly",
  "This promo code adds credit to your balance — apply it from Billing or the promo menu":
    "promo.balanceOnly",
  PROMO_DB_NOT_READY: "promo.dbNotReady",
  Unauthorized: "promo.unauthorized",
  "Deploy failed": "plans.deployFailed",
  "Order failed": "plans.deployFailed",
  "No capacity available in this location": "plans.noCapacity",
  "A server with this hostname is already being provisioned. Check My Services.":
    "plans.hostnameProvisioning",
  "Account is not active": "plans.accountInactive",
  "Billing is frozen on this account": "plans.billingFrozen",
};

export function getPromoErrorMessage(message: string, t: (key: string) => string): string {
  if (isNextProductionDigestError(message)) {
    return t("plans.deployFailed");
  }
  const key = PROMO_ERROR_KEYS[message];
  if (key) return t(key);
  return message.trim() || t("promo.errorDefault");
}
