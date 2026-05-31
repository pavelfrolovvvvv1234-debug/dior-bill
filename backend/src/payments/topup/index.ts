import { prisma, type TopUpProvider, type TopUpStatus, type Prisma } from "@dior/database";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  generateTopUpReference,
  TOPUP_MIN_AMOUNT,
  TOPUP_MAX_AMOUNT,
  ADMIN_ROLES,
} from "@dior/shared";
import { getProviderAdapter } from "../providers";
import { creditWallet } from "../wallet";
import { createAuditLog } from "../../audit";
import { toJsonValue } from "../../lib/json";
import { checkRateLimit } from "../../lib/rate-limit";
import { enqueueJob } from "../../lib/queue";
import { createNotification } from "../../notifications";
import {
  notifyAdminsManualTopUpPending,
  notifyAdminsTopUpPaid,
} from "../../telegram";
import { NOTIFICATION_TYPES } from "@dior/shared";
import { createHash } from "crypto";

export interface CreateTopUpInput {
  userId: string;
  amount: number;
  provider: TopUpProvider;
  idempotencyKey: string;
  returnUrl?: string;
}

export async function createTopUp(input: CreateTopUpInput) {
  const { allowed } = await checkRateLimit(
    `topup:create:${input.userId}`,
    10,
    60 * 60 * 1000,
  );
  if (!allowed) throw new ValidationError("Too many top-up requests. Try again later.");

  if (input.amount < TOPUP_MIN_AMOUNT || input.amount > TOPUP_MAX_AMOUNT) {
    throw new ValidationError(`Amount must be between $${TOPUP_MIN_AMOUNT} and $${TOPUP_MAX_AMOUNT}`);
  }

  const existing = await prisma.topUp.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;

  const fee = 0;
  const netAmount = input.amount - fee;
  let referenceCode = generateTopUpReference();
  while (await prisma.topUp.findUnique({ where: { referenceCode } })) {
    referenceCode = generateTopUpReference();
  }

  const returnUrl =
    input.returnUrl ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/topup`;

  const topUp = await prisma.topUp.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      fee,
      netAmount,
      provider: input.provider,
      status: input.provider === "MANUAL_TRANSFER" ? "MANUAL_REVIEW" : "PENDING",
      idempotencyKey: input.idempotencyKey,
      referenceCode,
    },
  });

  await logTopUpEvent(topUp.id, "created", { provider: input.provider, amount: input.amount });

  if (input.provider === "MANUAL_TRANSFER") {
    await createNotification({
      userId: input.userId,
      type: NOTIFICATION_TYPES.BILLING,
      title: "Manual transfer request created",
      body: `Reference ${referenceCode} — awaiting support confirmation`,
      link: `/billing/topup/${topUp.id}`,
    });
    await notifyAdminsManualTopUpPending({
      topUpId: topUp.id,
      userId: input.userId,
      amount: input.amount,
      referenceCode,
    });
    await notifyAdminsManualRequest(topUp.id, input.userId, input.amount, referenceCode);
    return topUp;
  }

  const adapter = getProviderAdapter(input.provider);
  try {
    const invoice = await adapter.createInvoice({
      topUpId: topUp.id,
      userId: input.userId,
      amount: input.amount,
      currency: "USD",
      referenceCode,
      idempotencyKey: input.idempotencyKey,
      returnUrl: `${returnUrl}/${topUp.id}`,
    });

    const updated = await prisma.topUp.update({
      where: { id: topUp.id },
      data: {
        externalId: invoice.externalId,
        paymentUrl: invoice.paymentUrl,
        expiresAt: invoice.expiresAt,
        status: "PROCESSING",
        metadata: toJsonValue(invoice.raw),
      },
    });

    await logTopUpEvent(topUp.id, "invoice_created", {
      externalId: invoice.externalId,
      paymentUrl: invoice.paymentUrl,
    });

    await createNotification({
      userId: input.userId,
      type: NOTIFICATION_TYPES.BILLING,
      title: "Payment invoice created",
      body: `$${input.amount.toFixed(2)} — complete payment to credit your balance`,
      link: `/billing/topup/${topUp.id}`,
    });

    await enqueueJob("payment.retry", { topUpId: topUp.id, action: "sync" });

    return updated;
  } catch (err) {
    await prisma.topUp.update({
      where: { id: topUp.id },
      data: {
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : "Invoice creation failed",
      },
    });
    throw err;
  }
}

export async function getTopUpById(topUpId: string, userId?: string) {
  const topUp = await prisma.topUp.findFirst({
    where: { id: topUpId, ...(userId && { userId }) },
    include: {
      events: { orderBy: { createdAt: "asc" }, take: 10 },
    },
  });
  if (!topUp) throw new NotFoundError("Top-up not found");
  return topUp;
}

export async function listUserTopUps(
  userId: string,
  filters?: { status?: TopUpStatus; provider?: TopUpProvider; page?: number; pageSize?: number },
) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const where: Prisma.TopUpWhereInput = {
    userId,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.provider && { provider: filters.provider }),
  };
  const [items, total] = await Promise.all([
    prisma.topUp.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { events: { orderBy: { createdAt: "desc" }, take: 3 } },
    }),
    prisma.topUp.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function completeTopUp(
  topUpId: string,
  options?: { actorId?: string; partialAmount?: number; adminNotes?: string },
) {
  return prisma.$transaction(async (tx) => {
    const topUp = await tx.topUp.findUnique({ where: { id: topUpId } });
    if (!topUp) throw new NotFoundError("Top-up not found");
    if (topUp.status === "PAID") return topUp;

    const creditAmount = options?.partialAmount ?? Number(topUp.netAmount);
    if (creditAmount <= 0) throw new ValidationError("Invalid credit amount");

    const { ledgerId } = await creditWallet({
      userId: topUp.userId,
      amount: creditAmount,
      description: `Balance top-up via ${topUp.provider} (${topUp.referenceCode})`,
      metadata: {
        topUpId: topUp.id,
        provider: topUp.provider,
        externalId: topUp.externalId,
      },
      actorId: options?.actorId,
      tx,
    });

    const updated = await tx.topUp.update({
      where: { id: topUpId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        netAmount: creditAmount,
        ledgerTxId: ledgerId,
        reviewedById: options?.actorId,
        reviewedAt: options?.actorId ? new Date() : undefined,
        adminNotes: options?.adminNotes,
      },
    });

    await tx.topUpEvent.create({
      data: {
        topUpId,
        event: "completed",
        payload: toJsonValue({ ledgerId, creditAmount }),
      },
    });

    return updated;
  }).then(async (updated) => {
    await createNotification({
      userId: updated.userId,
      type: NOTIFICATION_TYPES.BILLING,
      title: "Balance credited",
      body: `$${Number(updated.netAmount).toFixed(2)} added to your wallet`,
      link: "/billing",
    });
    await notifyAdminsTopUpPaid({
      topUpId: updated.id,
      userId: updated.userId,
      amount: Number(updated.netAmount),
      provider: updated.provider,
      referenceCode: updated.referenceCode,
    }).catch((err) => console.warn("[telegram] admin top-up notify:", err));
    await createAuditLog({
      actorId: options?.actorId ?? updated.userId,
      action: "topup.completed",
      entityType: "top_up",
      entityId: topUpId,
    });
    return updated;
  });
}

export async function failTopUp(topUpId: string, reason: string) {
  const updated = await prisma.topUp.update({
    where: { id: topUpId },
    data: { status: "FAILED", failureReason: reason },
  });
  await logTopUpEvent(topUpId, "failed", { reason });
  await createNotification({
    userId: updated.userId,
    type: NOTIFICATION_TYPES.BILLING,
    title: "Payment failed",
    body: reason,
    link: `/billing/topup/${topUpId}`,
  });
  return updated;
}

export async function expireTopUp(topUpId: string) {
  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp || topUp.status === "PAID") return topUp;
  const updated = await prisma.topUp.update({
    where: { id: topUpId },
    data: { status: "EXPIRED" },
  });
  await logTopUpEvent(topUpId, "expired", {});
  return updated;
}

export async function rejectManualTopUp(
  topUpId: string,
  actorId: string,
  reason: string,
) {
  await assertAdmin(actorId);
  const updated = await prisma.topUp.update({
    where: { id: topUpId },
    data: {
      status: "FAILED",
      failureReason: reason,
      reviewedById: actorId,
      reviewedAt: new Date(),
      adminNotes: reason,
    },
  });
  await logTopUpEvent(topUpId, "rejected", { actorId, reason });
  await createNotification({
    userId: updated.userId,
    type: NOTIFICATION_TYPES.BILLING,
    title: "Transfer request declined",
    body: reason,
    link: `/billing/topup/${topUpId}`,
  });
  return updated;
}

export async function approveManualTopUp(
  topUpId: string,
  actorId: string,
  options?: { partialAmount?: number; notes?: string },
) {
  await assertAdmin(actorId);
  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp) throw new NotFoundError();
  if (topUp.provider !== "MANUAL_TRANSFER") {
    throw new ValidationError("Not a manual transfer");
  }
  if (topUp.status === "PAID") return topUp;

  return completeTopUp(topUpId, {
    actorId,
    partialAmount: options?.partialAmount,
    adminNotes: options?.notes,
  });
}

export async function processExpiredTopUps() {
  const expired = await prisma.topUp.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      expiresAt: { lt: new Date() },
    },
    take: 100,
  });
  for (const t of expired) {
    await expireTopUp(t.id);
  }
  return expired.length;
}

export async function syncTopUpStatus(topUpId: string) {
  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp || topUp.status === "PAID" || topUp.status === "EXPIRED") return topUp;
  if (topUp.expiresAt && topUp.expiresAt < new Date()) {
    return expireTopUp(topUpId);
  }
  if (topUp.provider === "MANUAL_TRANSFER") return topUp;
  if (!topUp.externalId) return topUp;

  const adapter = getProviderAdapter(topUp.provider);
  if (!adapter.fetchPaymentStatus) return topUp;

  try {
    const parsed = await adapter.fetchPaymentStatus(topUp.externalId, {
      referenceCode: topUp.referenceCode,
      topUpId: topUp.id,
    });
    if (!parsed) return topUp;

    const { applyTopUpProviderUpdate } = await import("../webhooks");
    await applyTopUpProviderUpdate(topUp.provider, parsed, { skipIdempotency: true });
  } catch (err) {
    console.warn(`[topup] sync ${topUpId} failed:`, err);
  }

  return getTopUpById(topUpId);
}

async function logTopUpEvent(
  topUpId: string,
  event: string,
  payload?: Record<string, unknown>,
) {
  await prisma.topUpEvent.create({
    data: { topUpId, event, payload: toJsonValue(payload) },
  });
}

async function assertAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new ForbiddenError();
  }
}

async function notifyAdminsManualRequest(
  topUpId: string,
  userId: string,
  amount: number,
  referenceCode: string,
) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN", "OPERATOR", "SUPPORT"] } },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: NOTIFICATION_TYPES.BILLING,
      title: "Manual transfer pending",
      body: `$${amount.toFixed(2)} — ref ${referenceCode}`,
      link: `/payments?topup=${topUpId}`,
      channels: ["in_app", "telegram"],
    });
  }
}

export function buildWebhookId(provider: string, eventId: string): string {
  return createHash("sha256").update(`${provider}:${eventId}`).digest("hex");
}

export async function claimWebhookId(id: string, provider: string): Promise<boolean> {
  try {
    await prisma.webhookIdempotency.create({
      data: { id, provider },
    });
    return true;
  } catch {
    return false;
  }
}
