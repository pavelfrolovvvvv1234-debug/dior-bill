import { createHash } from "crypto";
import { prisma } from "@dior/database";
import type { TopUpProvider } from "@dior/database";
import { getProviderAdapter } from "../providers";
import {
  buildWebhookId,
  claimWebhookId,
  getTopUpById,
} from "../topup";
import { toJsonValue } from "../../lib/json";
import {
  handlePaymentConfirmation,
  mapWebhookToConfirmationStatus,
  handleOrphanWebhook,
} from "../../core/billing/payment-confirmation";
import type { ParsedWebhookPayload } from "../providers/types";

export async function handleProviderWebhook(
  provider: TopUpProvider,
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
  rawBody?: string,
) {
  const adapter = getProviderAdapter(provider);

  if (!adapter.verifyWebhook(headers, body, rawBody)) {
    throw new Error("Invalid webhook signature");
  }

  const parsed = adapter.parseWebhook(body);
  return applyTopUpProviderUpdate(provider, parsed);
}

export async function applyTopUpProviderUpdate(
  provider: TopUpProvider,
  parsed: ParsedWebhookPayload,
  options?: { skipIdempotency?: boolean },
) {
  const eventId =
    parsed.externalId ||
    String((parsed.raw as Record<string, unknown>).event_id ?? "") ||
    createHash("sha256").update(JSON.stringify(parsed.raw)).digest("hex").slice(0, 32);

  if (!options?.skipIdempotency) {
    const webhookKey = buildWebhookId(provider, eventId);
    const claimed = await claimWebhookId(webhookKey, provider);
    if (!claimed) {
      return { duplicate: true };
    }
  }

  const topUp = await resolveTopUpFromWebhook(provider, parsed);

  if (!topUp) {
    await handleOrphanWebhook(provider, parsed);
    return { orphan: true };
  }

  await prisma.topUpEvent.create({
    data: {
      topUpId: topUp.id,
      event: options?.skipIdempotency ? "sync" : "webhook",
      payload: toJsonValue(parsed.raw),
    },
  });

  const status = mapWebhookToConfirmationStatus(parsed, provider);

  await handlePaymentConfirmation({
    provider,
    topUpId: topUp.id,
    status,
    amount: parsed.amount,
    raw: parsed.raw,
  });

  const refreshed = await getTopUpById(topUp.id);
  return { topUp: refreshed };
}

async function resolveTopUpFromWebhook(
  provider: TopUpProvider,
  parsed: ParsedWebhookPayload,
) {
  let topUp = parsed.topUpId
    ? await prisma.topUp.findUnique({ where: { id: parsed.topUpId } })
    : null;

  if (!topUp && parsed.externalId) {
    topUp = await prisma.topUp.findFirst({
      where: { provider, externalId: parsed.externalId },
    });
  }

  if (!topUp) {
    const raw = parsed.raw as Record<string, unknown>;
    const orderId = String(raw.order_id ?? raw.extra ?? "");
    if (orderId) {
      topUp = await prisma.topUp.findUnique({ where: { referenceCode: orderId } });
    }
  }

  return topUp;
}
