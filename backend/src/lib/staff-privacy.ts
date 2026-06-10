import { prisma } from "@dior/database";
import {
  ADMIN_ROLES,
  assertCustomerEmailAllowed,
  normalizeRegistrationEmail,
  ValidationError,
} from "@dior/shared";

export async function assertEmailAvailableForCustomer(
  email: string,
  excludeUserId?: string,
): Promise<string> {
  const normalized = normalizeRegistrationEmail(email);
  assertCustomerEmailAllowed(normalized);

  const staffOwner = await prisma.user.findFirst({
    where: {
      email: normalized,
      role: { in: [...ADMIN_ROLES] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (staffOwner) {
    throw new ValidationError("This email address cannot be used");
  }

  return normalized;
}

export function redactStaffAuthorForCustomer<T extends { role: string; email: string | null }>(
  author: T,
): T {
  if ((ADMIN_ROLES as readonly string[]).includes(author.role)) {
    return { ...author, email: null };
  }
  return author;
}
