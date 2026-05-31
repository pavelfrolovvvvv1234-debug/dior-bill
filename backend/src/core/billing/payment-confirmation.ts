import { prisma, type TopUpProvider } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { appendDomainEvent } from "../events/store";
import { completeTopUp, failTopUp, expireTopUp } from "../../payments/topup";
import { emitPaymentConfirmed, emitPaymentFailed } from "./engine";
import { recordPaymentFingerprint } from "../abuse/fingerprint";
import { createAuditLog } from "../../audit";
import { toJsonValue } from "../../lib/json";
import type { ParsedWebhookPayload } from "../../payments/providers/types";

export type PaymentConfirmationStatus =
  | "pending_confirmation"
  | "confirmed"
  | "failed"
  | "expired"
  | "processing";

/**
 * Unified crypto/top-up confirmation — all providers route here.
 */
export async function handlePaymentConfirmation(params: {
  provider: TopUpProvider;
  topUpId: string;
  status: PaymentConfirmationStatus;
  amount?: number;
  confirmations?: number;
  requiredConfirmations?: number;
  fingerprint?: string;
  raw?: Record<string, unknown>;
}): Promise<{ handled: boolean; duplicate?: boolean }> {
  const topUp = await prisma.topUp.findUnique({ where: { id: params.topUpId } });
  if (!topUp) return { handled: false };

  if (params.fingerprint) {
    await recordPaymentFingerprint({
      userId: topUp.userId,
      fingerprintHash: params.fingerprint,
      provider: params.provider,
    });
  }

  const idemBase = `webhook:${params.provider}:${topUp.id}:${params.status}`;

  switch (params.status) {
    case "pending_confirmation":
    case "processing": {
      await prisma.topUp.update({
        where: { id: topUp.id },
        data: {
          status: "PROCESSING",
          metadata: toJsonValue({
            confirmations: params.confirmations ?? 0,
            requiredConfirmations: params.requiredConfirmations ?? 1,
            ...params.raw,
          }),
        },
      });
      await appendDomainEvent({
        eventType: DOMAIN_EVENTS.PAYMENT_PENDING_CONFIRMATION,
        aggregateType: "topup",
        aggregateId: topUp.id,
        userId: topUp.userId,
        payload: {
          provider: params.provider,
          confirmations: params.confirmations,
          requiredConfirmations: params.requiredConfirmations,
        },
        idempotencyKey: `${idemBase}:pending`,
      });
      return { handled: true };
    }

    case "confirmed": {
      if (topUp.status === "PAID") return { handled: true, duplicate: true };

      await completeTopUp(topUp.id);
      await emitPaymentConfirmed({
        userId: topUp.userId,
        topUpId: topUp.id,
        amount: params.amount ?? Number(topUp.netAmount),
        idempotencyKey: `${idemBase}:confirmed`,
        pendingConfirmation: false,
      });
      return { handled: true };
    }

    case "failed": {
      await failTopUp(topUp.id, "Payment failed at provider");
      await emitPaymentFailed({
        userId: topUp.userId,
        aggregateId: topUp.id,
        reason: "provider_failed",
        idempotencyKey: `${idemBase}:failed`,
      });
      return { handled: true };
    }

    case "expired": {
      await expireTopUp(topUp.id);
      await appendDomainEvent({
        eventType: DOMAIN_EVENTS.PAYMENT_EXPIRED,
        aggregateType: "topup",
        aggregateId: topUp.id,
        userId: topUp.userId,
        payload: { provider: params.provider },
        idempotencyKey: `${idemBase}:expired`,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export function mapWebhookToConfirmationStatus(
  parsed: ParsedWebhookPayload,
  _provider: TopUpProvider,
): PaymentConfirmationStatus {
  switch (parsed.status) {
    case "paid":
      return "confirmed";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "processing":
    case "pending":
      return "processing";
    default:
      return "processing";
  }
}

export async function handleOrphanWebhook(
  provider: TopUpProvider,
  parsed: ParsedWebhookPayload,
): Promise<void> {
  await createAuditLog({
    action: "webhook.orphan",
    entityType: "top_up",
    metadata: { provider, parsed: parsed.raw },
  });
}
