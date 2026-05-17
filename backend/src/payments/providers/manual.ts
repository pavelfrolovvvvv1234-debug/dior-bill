import type { PaymentProviderAdapter, CreateProviderInvoiceInput, ProviderInvoiceResult, ParsedWebhookPayload } from "./types";
import { MANUAL_SUPPORT_TELEGRAM } from "@dior/shared";

export const manualTransferProvider: PaymentProviderAdapter = {
  provider: "MANUAL_TRANSFER",

  async createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return {
      externalId: `manual_${input.referenceCode}`,
      paymentUrl: null,
      expiresAt,
      raw: {
        support: MANUAL_SUPPORT_TELEGRAM,
        instructions: `Contact ${MANUAL_SUPPORT_TELEGRAM} with reference ${input.referenceCode}`,
      },
    };
  },

  verifyWebhook() {
    return false;
  },

  parseWebhook(body): ParsedWebhookPayload {
    return {
      externalId: "",
      status: "pending",
      raw: body as Record<string, unknown>,
    };
  },
};
