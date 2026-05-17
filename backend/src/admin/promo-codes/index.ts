import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";

export async function listPromoCodes(actorId: string, page = 1, pageSize = 20) {
  await requirePermission(actorId, "promo.read");

  const take = Math.min(pageSize, 100);
  const [items, total] = await Promise.all([
    prisma.promoCode.findMany({
      skip: (page - 1) * take,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.promoCode.count(),
  ]);

  return { items, total, page, pageSize: take, totalPages: Math.ceil(total / take) };
}

export async function createPromoCode(
  actorId: string,
  data: {
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxUses?: number;
    validUntil?: Date;
  },
) {
  await requirePermission(actorId, "promo.write");

  const created = await prisma.promoCode.create({
    data: {
      code: data.code.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses,
      validUntil: data.validUntil,
      active: true,
    },
  });

  await createAuditLog({
    actorId,
    action: "promo.create",
    entityType: "promo_code",
    entityId: created.id,
    metadata: { code: created.code },
  });

  return created;
}

export async function togglePromoCode(actorId: string, id: string, active: boolean) {
  await requirePermission(actorId, "promo.write");

  const updated = await prisma.promoCode.update({
    where: { id },
    data: { active },
  });

  await createAuditLog({
    actorId,
    action: active ? "promo.enable" : "promo.disable",
    entityType: "promo_code",
    entityId: id,
  });

  return updated;
}

export async function deletePromoCode(actorId: string, id: string) {
  await requirePermission(actorId, "promo.write");

  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new NotFoundError();

  await prisma.promoCode.delete({ where: { id } });

  await createAuditLog({
    actorId,
    action: "promo.delete",
    entityType: "promo_code",
    entityId: id,
    metadata: { code: promo.code },
  });
}
