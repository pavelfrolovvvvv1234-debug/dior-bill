import { prisma, type PaymentMethod, type PaymentStatus } from "@dior/database";
import { toJsonValue } from "../lib/json";
import { NotFoundError, ValidationError } from "@dior/shared";
import { topUpBalance } from "../billing";
import { createAuditLog } from "../audit";

export interface CreatePaymentInput {
  userId: string;
  amount: number;
  method: PaymentMethod;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export async function createPayment(input: CreatePaymentInput) {
  const payment = await prisma.payment.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      method: input.method,
      currency: input.currency ?? "USD",
      status: "PENDING",
      webhookData: toJsonValue(input.metadata),
    },
  });

  await prisma.paymentEvent.create({
    data: { paymentId: payment.id, event: "created", payload: toJsonValue(input.metadata ?? {}) },
  });

  if (input.method === "BALANCE") {
    return completePayment(payment.id, "balance_internal");
  }

  return payment;
}

export async function completePayment(paymentId: string, externalId?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("Payment not found");
  if (payment.status === "COMPLETED") return payment;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "COMPLETED",
        externalId,
        completedAt: new Date(),
      },
    });
    await tx.paymentEvent.create({
      data: { paymentId, event: "completed", payload: toJsonValue({ externalId }) },
    });
  });

  if (payment.method !== "BALANCE") {
    await topUpBalance(
      payment.userId,
      Number(payment.amount),
      `Top-up via ${payment.method}`,
    );
  }

  await createAuditLog({
    actorId: payment.userId,
    action: "payment.completed",
    entityType: "payment",
    entityId: paymentId,
  });

  return prisma.payment.findUnique({ where: { id: paymentId } });
}

export async function failPayment(paymentId: string, reason: string) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      failureReason: reason,
      retryCount: { increment: 1 },
    },
  });
  await prisma.paymentEvent.create({
    data: { paymentId, event: "failed", payload: toJsonValue({ reason }) },
  });
  return payment;
}

export async function handleWebhook(
  method: PaymentMethod,
  externalId: string,
  payload: Record<string, unknown>,
) {
  const payment = await prisma.payment.findFirst({
    where: { externalId, method },
  });

  if (!payment) {
    const userId = payload.userId as string | undefined;
    const amount = payload.amount as number | undefined;
    if (!userId || !amount) throw new ValidationError("Invalid webhook payload");
    const created = await createPayment({ userId, amount, method, metadata: payload });
    if (!created) throw new ValidationError("Payment creation failed");
    await prisma.payment.update({
      where: { id: created.id },
      data: { externalId },
    });
    return completePayment(created.id, externalId);
  }

  await prisma.paymentEvent.create({
    data: { paymentId: payment.id, event: "webhook", payload: toJsonValue(payload) },
  });

  const status = payload.status as string;
  if (status === "completed" || status === "paid") {
    return completePayment(payment.id, externalId);
  }
  if (status === "failed") {
    return failPayment(payment.id, (payload.reason as string) ?? "Webhook failure");
  }

  return payment;
}

export async function retryPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "FAILED") {
    throw new ValidationError("Payment cannot be retried");
  }
  if (payment.retryCount >= 3) throw new ValidationError("Max retries exceeded");

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PENDING" },
  });

  const { enqueueJob } = await import("../lib/queue");
  await enqueueJob("payment.retry", { paymentId });

  return payment;
}

export async function getUserPayments(userId: string, page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.payment.count({ where: { userId } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
