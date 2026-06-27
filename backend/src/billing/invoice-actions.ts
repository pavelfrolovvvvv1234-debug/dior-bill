export type InvoiceBillingAction =
  | { type: "renewal"; serviceId: string }
  | {
      type: "upgrade";
      vpsId: string;
      cpuCores: number;
      ramMb: number;
      diskGb: number;
      monthlyPrice: number;
      planLabel?: string;
    };

const ACTION_PREFIX = "@@billing:";

export function encodeInvoiceBillingAction(action: InvoiceBillingAction): string {
  return `${ACTION_PREFIX}${JSON.stringify(action)}`;
}

export function parseInvoiceBillingAction(notes: string | null | undefined): InvoiceBillingAction | null {
  if (!notes?.startsWith(ACTION_PREFIX)) return null;
  try {
    const parsed = JSON.parse(notes.slice(ACTION_PREFIX.length)) as InvoiceBillingAction;
    if (parsed?.type === "renewal" || parsed?.type === "upgrade") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}
