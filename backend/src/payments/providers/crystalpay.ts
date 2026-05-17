import { createHash } from "crypto";
import type { PaymentProviderAdapter, CreateProviderInvoiceInput, ProviderInvoiceResult, ParsedWebhookPayload } from "./types";

const API_BASE = process.env.CRYSTALPAY_API_URL ?? "https://api.crystalpay.io/v2";

export const crystalpayProvider: PaymentProviderAdapter = {
  provider: "CRYSTALPAY",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    const authLogin = process.env.CRYSTALPAY_AUTH_LOGIN;
    const authSecret = process.env.CRYSTALPAY_AUTH_SECRET;

    if (!authLogin || !authSecret) {
      return {
        externalId: `cp_sim_${input.topUpId}`,
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/topup/${input.topUpId}?sim=crystalpay`,
        expiresAt: defaultExpiry(),
        raw: { simulated: true },
      };
    }

    const res = await fetch(`${API_BASE}/invoice/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_login: authLogin,
        auth_secret: authSecret,
        amount: input.amount,
        type: "purchase",
        lifetime: Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60),
        description: `Balance top-up ${input.referenceCode}`,
        extra: input.referenceCode,
        callback_url: `${process.env.API_URL}/webhooks/crystalpay`,
      }),
    });

    const data = (await res.json()) as {
      error?: boolean;
      id?: string;
      url?: string;
      expired_at?: string;
    };

    if (data.error || !data.id) {
      throw new Error("CrystalPay invoice creation failed");
    }

    return {
      externalId: data.id,
      paymentUrl: data.url ?? null,
      expiresAt: data.expired_at ? new Date(data.expired_at) : defaultExpiry(),
      raw: data as unknown as Record<string, unknown>,
    };
  },

  verifyWebhook(_headers, body) {
    const secret = process.env.CRYSTALPAY_CALLBACK_SECRET;
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
};

function defaultExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60));
  return d;
}
