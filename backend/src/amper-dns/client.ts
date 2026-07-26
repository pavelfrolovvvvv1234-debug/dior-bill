import { AppError } from "@dior/shared";
import {
  getAmperDnsApiBaseUrl,
  getAmperDnsApiKey,
  getAmperDnsTimeoutMs,
  isAmperDnsConfigured,
} from "./config";

export class AmperDnsApiError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode = 502,
    public readonly details?: unknown,
  ) {
    super(message, code, statusCode);
    this.name = "AmperDnsApiError";
  }
}

function extractErrorMessage(body: unknown, status: number): { message: string; code: string; details?: unknown } {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const err = o.error;
    if (typeof err === "string") {
      return { message: err, code: "AMPER_DNS_ERROR", details: o };
    }
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      return {
        message: String(e.message ?? e.reason ?? e.code ?? "Amper DNS error"),
        code: String(e.code ?? "AMPER_DNS_ERROR"),
        details: e.details ?? o,
      };
    }
    if (typeof o.message === "string") {
      return { message: o.message, code: String(o.reason ?? "AMPER_DNS_ERROR"), details: o };
    }
    if (typeof o.reason === "string") {
      return { message: o.reason, code: "AMPER_DNS_ERROR", details: o };
    }
  }
  return { message: `Amper DNS API error (${status})`, code: "AMPER_DNS_HTTP", details: body };
}

export async function amperDnsRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {},
): Promise<T> {
  if (!isAmperDnsConfigured()) {
    throw new AmperDnsApiError("Amper DNS is not configured", "AMPER_DNS_NOT_CONFIGURED", 503);
  }

  const base = getAmperDnsApiBaseUrl();
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${pathNorm}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAmperDnsTimeoutMs());

  try {
    const res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        "X-Api-Key": getAmperDnsApiKey(),
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new AmperDnsApiError(
          `Amper DNS returned invalid JSON (${res.status})`,
          "AMPER_DNS_INVALID_RESPONSE",
          res.status || 502,
        );
      }
    }

    if (!res.ok) {
      const mapped = extractErrorMessage(json, res.status);
      throw new AmperDnsApiError(mapped.message, mapped.code, res.status, mapped.details);
    }

    if (json && typeof json === "object" && "success" in json) {
      const envelope = json as { success: boolean; data?: T; error?: unknown };
      if (!envelope.success) {
        const mapped = extractErrorMessage(json, res.status);
        throw new AmperDnsApiError(mapped.message, mapped.code, res.status || 502, mapped.details);
      }
      return (envelope.data ?? ({} as T)) as T;
    }

    return (json ?? {}) as T;
  } catch (err) {
    if (err instanceof AmperDnsApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AmperDnsApiError("Amper DNS request timed out", "AMPER_DNS_TIMEOUT", 504);
    }
    throw new AmperDnsApiError(
      err instanceof Error ? err.message : "Amper DNS request failed",
      "AMPER_DNS_NETWORK",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
