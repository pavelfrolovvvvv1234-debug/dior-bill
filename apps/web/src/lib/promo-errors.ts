const PROMO_ERROR_KEYS: Record<string, string> = {
  "Enter a promo code": "promo.enterCode",
  "Invalid promo code": "promo.invalid",
  "Promo code exhausted": "promo.exhausted",
  "Promo not yet valid": "promo.notYetValid",
  "Promo expired": "promo.expired",
  "Promo code has no value": "promo.noValue",
  "You have already used this promo code": "promo.alreadyUsed",
  PROMO_DB_NOT_READY: "promo.dbNotReady",
  Unauthorized: "promo.unauthorized",
};

export function getPromoErrorMessage(message: string, t: (key: string) => string): string {
  const key = PROMO_ERROR_KEYS[message];
  if (key) return t(key);
  return message.trim() || t("promo.errorDefault");
}
