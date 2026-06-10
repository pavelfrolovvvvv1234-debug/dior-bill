import { ValidationError } from "./errors";
import { normalizeRegistrationEmail } from "./auth-validation";

/** Staff / control-panel addresses that customers must never claim or see in the UI */
export const RESERVED_STAFF_EMAILS = ["admin@dior.cloud"] as const;

export const STAFF_TICKET_AUTHOR_LABEL = "Support";

export function isReservedStaffEmail(email: string): boolean {
  const normalized = normalizeRegistrationEmail(email);
  return (RESERVED_STAFF_EMAILS as readonly string[]).includes(normalized);
}

export function assertCustomerEmailAllowed(email: string): void {
  if (isReservedStaffEmail(email)) {
    throw new ValidationError("This email address cannot be used");
  }
}
