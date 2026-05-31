import type { TopUpProvider } from "@dior/database";
import type { TopUpProviderId } from "@dior/shared";

export interface CreateProviderInvoiceInput {
  topUpId: string;
  userId: string;
  amount: number;
  currency: string;
  referenceCode: string;
  idempotencyKey: string;
  returnUrl: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderInvoiceResult {
  externalId: string;
  paymentUrl: string | null;
  expiresAt: Date;
  raw?: Record<string, unknown>;
}

export interface ParsedWebhookPayload {
  externalId: string;
  topUpId?: string;
  status: "paid" | "failed" | "expired" | "processing" | "pending";
  amount?: number;
  raw: Record<string, unknown>;
}

export interface PaymentStatusContext {
  referenceCode?: string;
  topUpId?: string;
}

export interface PaymentProviderAdapter {
  readonly provider: TopUpProvider;
  createInvoice(input: CreateProviderInvoiceInput): Promise<ProviderInvoiceResult>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    rawBody?: string,
  ): boolean;
  parseWebhook(body: unknown): ParsedWebhookPayload;
  fetchPaymentStatus?(
    externalId: string,
    context?: PaymentStatusContext,
  ): Promise<ParsedWebhookPayload | null>;
}

export function providerIdToEnum(id: TopUpProviderId): TopUpProvider {
  return id as TopUpProvider;
}
