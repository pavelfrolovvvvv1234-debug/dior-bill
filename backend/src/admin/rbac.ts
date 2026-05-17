import { prisma } from "@dior/database";
import type { UserRole } from "@dior/database";
import {
  ADMIN_ROLES,
  ForbiddenError,
  hasPermission,
  type ControlPermission,
} from "@dior/shared";

export async function getActorRole(actorId: string): Promise<UserRole> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  if (!actor || !ADMIN_ROLES.includes(actor.role as (typeof ADMIN_ROLES)[number])) {
    throw new ForbiddenError();
  }
  return actor.role;
}

export async function requirePermission(actorId: string, permission: ControlPermission) {
  const role = await getActorRole(actorId);
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return role;
}

export async function requireStaff(actorId: string) {
  return getActorRole(actorId);
}
