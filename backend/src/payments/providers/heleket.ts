import { createHmac } from "crypto";
import type {
  PaymentProviderAdapter,
  CreateProviderInvoiceInput,
  ProviderInvoiceResult,
  ParsedWebhookPayload,
} from "./types";
import { assertProviderConfigured, isProductionRuntime, paymentConfig } from "../config";

export const heleketProvider: PaymentProviderAdapter = {
  provider: "HELEKET",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    assertProviderConfigured("HELEKET");
    const apiKey = paymentConfig.heleket.apiKey;
    const merchantId = paymentConfig.heleket.merchantId;
    if (!apiKey || !merchantId) {
      if (!isProductionRuntime()) {
        return {
          externalId: `hk_sim_${input.topUpId}`,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/topup/${input.topUpId}?sim=heleket`,
          expiresAt: defaultExpiry(),
          raw: { simulated: true },
        };
      }
      throw new Error("Heleket credentials are not configured");
    }

    const API_BASE = paymentConfig.heleket.apiUrl;

    const res = await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Merchant-Id": merchantId,
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        order_id: input.referenceCode,
        idempotency_key: input.idempotencyKey,
        callback_url: `${process.env.API_URL}/webhooks/heleket`,
        success_url: input.returnUrl,
        metadata: { top_up_id: input.topUpId, user_id: input.userId },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Heleket invoice failed: ${err}`);
    }

    const data = (await res.json()) as {
      id: string;
      pay_url?: string;
      payment_url?: string;
      url?: string;
      expires_at?: string;
    };

    const payUrl = data.pay_url ?? data.payment_url ?? data.url;
    if (!payUrl) {
      throw new Error("Heleket did not return a payment URL");
    }

    return {
      externalId: data.id,
      paymentUrl: payUrl,
      expiresAt: data.expires_at ? new Date(data.expires_at) : defaultExpiry(),
      raw: data as unknown as Record<string, unknown>,
    };
  },

  verifyWebhook(headers, body) {
    const secret = paymentConfig.heleket.webhookSecret;
    if (!secret) return process.env.NODE_ENV === "development";
    const sig = headers["x-heleket-signature"] ?? headers["x-signature"];
    if (typeof sig !== "string") return false;
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    return sig === expected;
  },

  parseWebhook(body): ParsedWebhookPayload {
    const data = body as Record<string, unknown>;
    const statusMap: Record<string, ParsedWebhookPayload["status"]> = {
      paid: "paid",
      completed: "paid",
      success: "paid",
      failed: "failed",
      expired: "expired",
      pending: "pending",
      processing: "processing",
    };
    const status = statusMap[String(data.status ?? "").toLowerCase()] ?? "pending";
    return {
      externalId: String(data.invoice_id ?? data.id ?? ""),
      topUpId:
        data.metadata && typeof data.metadata === "object"
          ? String((data.metadata as Record<string, unknown>).top_up_id ?? "")
          : undefined,
      status,
      amount: data.amount ? Number(data.amount) : undefined,
      raw: data,
    };
  },
};

function defaultExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60));
  return d;
}
