import { createHash } from "crypto";
import type {
  PaymentProviderAdapter,
  CreateProviderInvoiceInput,
  ProviderInvoiceResult,
  ParsedWebhookPayload,
} from "./types";
import { assertProviderConfigured, isProductionRuntime, paymentConfig } from "../config";

const API_BASE = "https://pay.crypt.bot/api";

export const cryptobotProvider: PaymentProviderAdapter = {
  provider: "CRYPTOBOT",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    assertProviderConfigured("CRYPTOBOT");
    const token = paymentConfig.cryptobot.token;
    if (!token) {
      if (!isProductionRuntime()) {
        return {
          externalId: `cb_sim_${input.topUpId}`,
          paymentUrl: `https://t.me/${paymentConfig.cryptobot.botUsername}`,
          expiresAt: defaultExpiry(),
          raw: { simulated: true },
        };
      }
      throw new Error("CryptoBot API token is not configured");
    }

    const res = await fetch(`${API_BASE}/createInvoice`, {
      method: "POST",
      headers: { "Crypto-Pay-API-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        currency_type: "fiat",
        fiat: input.currency,
        amount: String(input.amount),
        description: `DiorHost balance top-up ${input.referenceCode}`,
        payload: JSON.stringify({ top_up_id: input.topUpId, user_id: input.userId }),
        paid_btn_name: "openBot",
        paid_btn_url: input.returnUrl,
        expires_in: Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60) * 60,
      }),
    });

    const json = (await res.json()) as {
      ok: boolean;
      result?: { invoice_id: number; pay_url: string; expiration_date?: string };
      error?: { name?: string; code?: string };
    };
    if (!json.ok || !json.result?.pay_url) {
      const detail = json.error?.name ?? json.error?.code ?? "unknown error";
      throw new Error(`CryptoBot createInvoice failed: ${detail}`);
    }

    return {
      externalId: String(json.result.invoice_id),
      paymentUrl: json.result.pay_url,
      expiresAt: json.result.expiration_date
        ? new Date(json.result.expiration_date)
        : defaultExpiry(),
      raw: json.result as unknown as Record<string, unknown>,
    };
  },

  verifyWebhook(headers, body, rawBody) {
    const token = paymentConfig.cryptobot.token;
    if (!token) return process.env.NODE_ENV === "development";
    const signature = headers["crypto-pay-api-signature"];
    if (typeof signature !== "string") return false;
    const secret = createHash("sha256").update(token).digest();
    const payload =
      rawBody ?? (typeof body === "string" ? body : JSON.stringify(body));
    const check = createHash("sha256").update(secret).update(payload).digest("hex");
    return signature === check;
  },

  parseWebhook(body): ParsedWebhookPayload {
    const envelope = body as { update_type?: string; payload?: Record<string, unknown> };
    const invoice = envelope.payload ?? (body as Record<string, unknown>);
    const status = String(invoice.status ?? "").toLowerCase();
    let mapped: ParsedWebhookPayload["status"] = "pending";
    if (status === "paid") mapped = "paid";
    else if (status === "expired") mapped = "expired";

    let topUpId: string | undefined;
    if (invoice.payload && typeof invoice.payload === "string") {
      try {
        const p = JSON.parse(invoice.payload) as { top_up_id?: string };
        topUpId = p.top_up_id;
      } catch {
        /* ignore */
      }
    }

    return {
      externalId: String(invoice.invoice_id ?? ""),
      topUpId,
      status: mapped,
      amount: invoice.amount ? Number(invoice.amount) : undefined,
      raw: invoice,
    };
  },

  async fetchPaymentStatus(externalId) {
    const token = paymentConfig.cryptobot.token;
    if (!token) return null;

    const res = await fetch(`${API_BASE}/getInvoices`, {
      method: "POST",
      headers: { "Crypto-Pay-API-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_ids: externalId }),
    });

    const json = (await res.json()) as {
      ok: boolean;
      result?: { items?: Array<Record<string, unknown>> };
    };
    if (!json.ok || !json.result?.items?.length) return null;

    const invoice = json.result.items[0];
    const status = String(invoice.status ?? "").toLowerCase();
    let mapped: ParsedWebhookPayload["status"] = "pending";
    if (status === "paid") mapped = "paid";
    else if (status === "expired") mapped = "expired";

    let topUpId: string | undefined;
    if (invoice.payload && typeof invoice.payload === "string") {
      try {
        const p = JSON.parse(invoice.payload) as { top_up_id?: string };
        topUpId = p.top_up_id;
      } catch {
        /* ignore */
      }
    }

    return {
      externalId: String(invoice.invoice_id ?? externalId),
      topUpId,
      status: mapped,
      amount: invoice.amount ? Number(invoice.amount) : undefined,
      raw: invoice,
    };
  },
};

function defaultExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60));
  return d;
}
