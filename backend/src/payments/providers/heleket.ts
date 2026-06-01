import type {
  PaymentProviderAdapter,
  CreateProviderInvoiceInput,
  ProviderInvoiceResult,
  ParsedWebhookPayload,
} from "./types";
import { assertProviderConfigured, isProductionRuntime, paymentConfig } from "../config";
import { heleketApiRequest, verifyHeleketWebhook, signHeleketBody } from "./heleket-api";
import { paymentWebhookUrl } from "../webhook-url";

type HeleketPaymentResult = {
  uuid: string;
  url: string;
  expired_at?: number | string;
  order_id?: string;
};

export const heleketProvider: PaymentProviderAdapter = {
  provider: "HELEKET",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    assertProviderConfigured("HELEKET");

    if (!paymentConfig.heleket.apiKey || !paymentConfig.heleket.merchantId) {
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

    const lifetimeSec = Math.min(
      43200,
      Math.max(300, Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60) * 60),
    );

    const result = await heleketApiRequest<HeleketPaymentResult>({
      amount: String(input.amount),
      currency: input.currency.toUpperCase(),
      order_id: input.referenceCode,
      url_callback: paymentWebhookUrl("heleket"),
      url_return: input.returnUrl,
      url_success: input.returnUrl,
      lifetime: lifetimeSec,
      additional_data: JSON.stringify({ top_up_id: input.topUpId }),
      is_payment_multiple: false,
    });

    if (!result.url) {
      throw new Error("Heleket did not return a payment URL");
    }

    let expiresAt = defaultExpiry();
    if (result.expired_at != null) {
      const ts = Number(result.expired_at);
      expiresAt = Number.isFinite(ts)
        ? new Date(ts > 1e12 ? ts : ts * 1000)
        : new Date(String(result.expired_at));
    }

    return {
      externalId: result.uuid,
      paymentUrl: result.url,
      expiresAt,
      raw: result as unknown as Record<string, unknown>,
    };
  },

  verifyWebhook(_headers, body, rawBody) {
    const apiKey = paymentConfig.heleket.apiKey;
    if (!apiKey) return process.env.NODE_ENV === "development";
    if (rawBody) {
      const received = String((body as Record<string, unknown>).sign ?? "");
      if (!received) return false;
      return signHeleketBody(rawBody, apiKey) === received;
    }
    return verifyHeleketWebhook(body, apiKey);
  },

  parseWebhook(body): ParsedWebhookPayload {
    const data = body as Record<string, unknown>;
    const paymentStatus = String(data.payment_status ?? data.status ?? "").toLowerCase();

    const statusMap: Record<string, ParsedWebhookPayload["status"]> = {
      paid: "paid",
      paid_over: "paid",
      wrong_amount: "pending",
      wrong_amount_waiting: "pending",
      process: "processing",
      confirm_check: "processing",
      check: "pending",
      fail: "failed",
      cancel: "expired",
      system_fail: "failed",
    };
    const status = statusMap[paymentStatus] ?? "pending";

    let topUpId: string | undefined;
    if (data.additional_data && typeof data.additional_data === "string") {
      try {
        const meta = JSON.parse(data.additional_data) as { top_up_id?: string };
        topUpId = meta.top_up_id;
      } catch {
        /* ignore */
      }
    }

    return {
      externalId: String(data.uuid ?? data.invoice_id ?? data.id ?? ""),
      topUpId,
      status,
      amount: data.payment_amount_usd
        ? Number(data.payment_amount_usd)
        : data.amount
          ? Number(data.amount)
          : undefined,
      raw: data,
    };
  },

  async fetchPaymentStatus(externalId, context) {
    if (!paymentConfig.heleket.apiKey || !paymentConfig.heleket.merchantId) {
      return null;
    }

    const payload: Record<string, unknown> = { uuid: externalId };
    if (context?.referenceCode) {
      payload.order_id = context.referenceCode;
    }

    const result = await heleketApiRequest<Record<string, unknown>>(payload, "payment/info");
    const paymentStatus = String(result.payment_status ?? result.status ?? "").toLowerCase();

    const statusMap: Record<string, ParsedWebhookPayload["status"]> = {
      paid: "paid",
      paid_over: "paid",
      wrong_amount: "pending",
      wrong_amount_waiting: "pending",
      process: "processing",
      confirm_check: "processing",
      check: "pending",
      fail: "failed",
      cancel: "expired",
      system_fail: "failed",
    };
    const status = statusMap[paymentStatus] ?? "pending";

    let topUpId: string | undefined = context?.topUpId;
    if (result.additional_data && typeof result.additional_data === "string") {
      try {
        const meta = JSON.parse(result.additional_data) as { top_up_id?: string };
        topUpId = meta.top_up_id ?? topUpId;
      } catch {
        /* ignore */
      }
    }

    return {
      externalId: String(result.uuid ?? externalId),
      topUpId,
      status,
      amount: result.payment_amount_usd
        ? Number(result.payment_amount_usd)
        : result.amount
          ? Number(result.amount)
          : undefined,
      raw: result,
    };
  },
};

function defaultExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.TOPUP_EXPIRY_MINUTES ?? 60));
  return d;
}
