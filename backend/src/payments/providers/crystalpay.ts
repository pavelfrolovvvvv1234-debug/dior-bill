import { createHash } from "crypto";
import type {
  PaymentProviderAdapter,
  CreateProviderInvoiceInput,
  ProviderInvoiceResult,
  ParsedWebhookPayload,
} from "./types";
import { assertProviderConfigured, isProductionRuntime, paymentConfig } from "../config";

export const crystalpayProvider: PaymentProviderAdapter = {
  provider: "CRYSTALPAY",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    assertProviderConfigured("CRYSTALPAY");
    const authLogin = paymentConfig.crystalpay.authLogin;
    const authSecret = paymentConfig.crystalpay.authSecret;
    if (!authLogin || !authSecret) {
      if (!isProductionRuntime()) {
        return {
          externalId: `cp_sim_${input.topUpId}`,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/topup/${input.topUpId}?sim=crystalpay`,
          expiresAt: defaultExpiry(),
          raw: { simulated: true },
        };
      }
      throw new Error("CrystalPay credentials are not configured");
    }

    const API_BASE = paymentConfig.crystalpay.apiUrl;

    const res = await fetch(`${API_BASE}/invoice/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_login: authLogin,
        auth_secret: authSecret,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        amount_currency: input.currency.toUpperCase(),
        type: "purchase",
        lifetime: Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60),
        description: `Balance top-up ${input.referenceCode}`,
        extra: input.referenceCode,
        callback_url: `${process.env.API_URL}/webhooks/crystalpay`,
        redirect_url: input.returnUrl,
      }),
    });

    const data = (await res.json()) as {
      error?: boolean;
      errors?: unknown[];
      id?: string;
      url?: string;
      expired_at?: string;
    };

    if (data.error || !data.id) {
      const detail = Array.isArray(data.errors) ? JSON.stringify(data.errors) : "API error";
      throw new Error(`CrystalPay invoice creation failed: ${detail}`);
    }

    if (!data.url) {
      throw new Error("CrystalPay did not return a payment URL");
    }

    return {
      externalId: data.id,
      paymentUrl: data.url,
      expiresAt: data.expired_at ? new Date(data.expired_at) : defaultExpiry(),
      raw: data as unknown as Record<string, unknown>,
    };
  },

  verifyWebhook(_headers, body) {
    const secret = paymentConfig.crystalpay.callbackSecret;
    if (!secret) return process.env.NODE_ENV === "development";
    const data = body as Record<string, unknown>;
    const signature = String(data.signature ?? "");
    const id = String(data.id ?? "");
    const salt = String(data.salt ?? "");
    const expected = createHash("sha256").update(`${id}:${salt}:${secret}`).digest("hex");
    return signature === expected;
  },

  parseWebhook(body): ParsedWebhookPayload {
    const data = body as Record<string, unknown>;
    const state = String(data.state ?? "").toLowerCase();
    let status: ParsedWebhookPayload["status"] = "pending";
    if (state === "payed" || state === "paid" || state === "completed") status = "paid";
    else if (state === "failed") status = "failed";
    else if (state === "expired") status = "expired";

    return {
      externalId: String(data.id ?? ""),
      status,
      amount: data.amount ? Number(data.amount) : undefined,
      raw: data,
    };
  },

  async fetchPaymentStatus(externalId, context) {
    const authLogin = paymentConfig.crystalpay.authLogin;
    const authSecret = paymentConfig.crystalpay.authSecret;
    if (!authLogin || !authSecret) return null;

    const API_BASE = paymentConfig.crystalpay.apiUrl;
    const res = await fetch(`${API_BASE}/invoice/info/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_login: authLogin,
        auth_secret: authSecret,
        id: externalId,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (data.error) return null;

    const state = String(data.state ?? "").toLowerCase();
    let status: ParsedWebhookPayload["status"] = "pending";
    if (state === "payed" || state === "paid" || state === "completed") status = "paid";
    else if (state === "failed") status = "failed";
    else if (state === "expired" || state === "unavailable") status = "expired";
    else if (state === "processing") status = "processing";

    const extra = String(data.extra ?? context?.referenceCode ?? "");

    return {
      externalId: String(data.id ?? externalId),
      topUpId: context?.topUpId,
      status,
      amount: data.amount ? Number(data.amount) : undefined,
      raw: { ...data, extra },
    };
  },
};

function defaultExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60));
  return d;
}
