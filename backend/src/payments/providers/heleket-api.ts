import { createHash } from "crypto";
import { paymentConfig } from "../config";

/** Heleket sign: md5(base64(jsonBody) + apiKey) */
export function signHeleketBody(jsonBody: string, apiKey: string): string {
  const encoded = Buffer.from(jsonBody, "utf8").toString("base64");
  return createHash("md5").update(encoded + apiKey).digest("hex");
}

export function verifyHeleketWebhook(body: unknown, apiKey: string): boolean {
  if (!body || typeof body !== "object") return false;
  const data = { ...(body as Record<string, unknown>) };
  const received = String(data.sign ?? "");
  if (!received) return false;
  delete data.sign;
  const json = JSON.stringify(data);
  return signHeleketBody(json, apiKey) === received;
}

export type HeleketApiEnvelope<T> = {
  state: number;
  result?: T;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function heleketApiRequest<T>(payload: Record<string, unknown>): Promise<T> {
  const apiKey = paymentConfig.heleket.apiKey;
  const merchantId = paymentConfig.heleket.merchantId;
  if (!apiKey || !merchantId) {
    throw new Error("Heleket credentials are not configured");
  }

  const base = paymentConfig.heleket.apiUrl.replace(/\/$/, "");
  const body = JSON.stringify(payload);
  const res = await fetch(`${base}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      merchant: merchantId,
      sign: signHeleketBody(body, apiKey),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatHeleketHttpError(res.status, text));
  }

  let json: HeleketApiEnvelope<T>;
  try {
    json = JSON.parse(text) as HeleketApiEnvelope<T>;
  } catch {
    throw new Error("Heleket returned invalid JSON");
  }

  if (json.state !== 0 || !json.result) {
    const detail =
      json.message ??
      (json.errors ? JSON.stringify(json.errors) : `Heleket API error (state ${json.state})`);
    throw new Error(detail);
  }

  return json.result;
}

function formatHeleketHttpError(status: number, text: string): string {
  if (text.includes("<html") || text.includes("<!DOCTYPE")) {
    const title = text.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    return title ? `Heleket HTTP ${status}: ${title}` : `Heleket HTTP ${status}`;
  }
  try {
    const json = JSON.parse(text) as { message?: string };
    if (json.message) return json.message;
  } catch {
    /* ignore */
  }
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}
