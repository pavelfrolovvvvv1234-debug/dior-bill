import { prisma } from "@dior/database";
import { NotFoundError, validatePromoCreateInput } from "@dior/shared";
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

  const validated = validatePromoCreateInput(data);

  const created = await prisma.promoCode.create({
    data: {
      code: validated.code,
      discountType: validated.discountType,
      discountValue: validated.discountValue,
      maxUses: validated.maxUses,
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

export async function listPromoRedemptions(
  actorId: string,
  options: { promoCodeId?: string; userId?: string; page?: number; pageSize?: number } = {},
) {
  await requirePermission(actorId, "promo.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 30, 100);

  const where = {
    ...(options.promoCodeId && { promoCodeId: options.promoCodeId }),
    ...(options.userId && { userId: options.userId }),
  };

  const [items, total] = await Promise.all([
    prisma.promoCodeRedemption.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true } },
        promoCode: { select: { id: true, code: true, discountType: true } },
      },
    }),
    prisma.promoCodeRedemption.count({ where }),
  ]);

  return {
    items: items.map((r) => ({
      id: r.id,
      credit: Number(r.credit),
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      promoCode: r.promoCode,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPromoCodeDetail(actorId: string, id: string) {
  await requirePermission(actorId, "promo.read");

  const promo = await prisma.promoCode.findUnique({
    where: { id },
    include: {
      redemptions: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });
  if (!promo) throw new NotFoundError();

  return {
    ...promo,
    discountValue: Number(promo.discountValue),
    validFrom: promo.validFrom?.toISOString() ?? null,
    validUntil: promo.validUntil?.toISOString() ?? null,
    createdAt: promo.createdAt.toISOString(),
    redemptions: promo.redemptions.map((r) => ({
      id: r.id,
      credit: Number(r.credit),
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  };
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
