import { prisma } from "@dior/database";
import { getProviderAdapter } from "../providers";
import type { TopUpProvider } from "@dior/database";
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
import { createHash } from "crypto";

export async function handleProviderWebhook(
  provider: TopUpProvider,
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
) {
  const adapter = getProviderAdapter(provider);

  if (!adapter.verifyWebhook(headers, body)) {
    throw new Error("Invalid webhook signature");
  }

  const parsed = adapter.parseWebhook(body);
  const eventId =
    parsed.externalId ||
    String((parsed.raw as Record<string, unknown>).event_id ?? "") ||
    createHash("sha256").update(JSON.stringify(parsed.raw)).digest("hex").slice(0, 32);

  const webhookKey = buildWebhookId(provider, eventId);
  const claimed = await claimWebhookId(webhookKey, provider);
  if (!claimed) {
    return { duplicate: true };
  }

  let topUp = parsed.topUpId
    ? await prisma.topUp.findUnique({ where: { id: parsed.topUpId } })
    : null;

  if (!topUp && parsed.externalId) {
    topUp = await prisma.topUp.findFirst({
      where: { provider, externalId: parsed.externalId },
    });
  }

  if (!topUp) {
    await handleOrphanWebhook(provider, parsed);
    return { orphan: true };
  }

  await prisma.topUpEvent.create({
    data: {
      topUpId: topUp.id,
      event: "webhook",
      payload: toJsonValue(parsed.raw),
    },
  });

  const status = mapWebhookToConfirmationStatus(parsed, provider);
  const raw = parsed.raw as Record<string, unknown>;
  const fingerprint = createHash("sha256")
    .update(
      `${provider}:${raw.payer_id ?? raw.user_id ?? raw.from ?? topUp.userId}`,
    )
    .digest("hex");

  await handlePaymentConfirmation({
    provider,
    topUpId: topUp.id,
    status,
    amount: parsed.amount,
    confirmations: Number(raw.confirmations ?? raw.confirmation_count ?? 0),
    requiredConfirmations: Number(raw.required_confirmations ?? 3),
    fingerprint,
    raw: parsed.raw,
  });

  const refreshed = await getTopUpById(topUp.id);
  return { topUp: refreshed };
}
