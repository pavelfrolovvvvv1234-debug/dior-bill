import { AppError } from "@dior/shared";
import {
  buildAmperAuthHeader,
  getAmperApiBaseUrl,
  getAmperApiToken,
  getAmperTimeoutMs,
  isAmperConfigured,
} from "./config";
import type { AmperApiErrorBody, AmperApiSuccess } from "./types";

const AMPER_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_API_KEY: 401,
  INVALID_AUTH_FORMAT: 401,
  USER_BANNED: 403,
  VALIDATION_ERROR: 400,
  INVALID_DOMAIN: 400,
  DOMAIN_UNAVAILABLE: 400,
  DOMAIN_ALREADY_OWNED: 409,
  INSUFFICIENT_BALANCE: 402,
  NOT_FOUND: 404,
  DOMAIN_NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  API_ERROR: 502,
};

export class AmperApiError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode = 502,
    public readonly details?: unknown,
  ) {
    super(message, code, statusCode);
    this.name = "AmperApiError";
  }
}

function mapAmperError(body: AmperApiErrorBody): AmperApiError {
  const code = body.error.code;
  const status = AMPER_STATUS[code] ?? 502;
  return new AmperApiError(body.error.message, code, status, body.error.details);
}

export async function amperRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {},
): Promise<T> {
  if (!isAmperConfigured()) {
    throw new AmperApiError("Amper API is not configured", "AMPER_NOT_CONFIGURED", 503);
  }

  const base = getAmperApiBaseUrl();
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${pathNorm}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAmperTimeoutMs());

  try {
    const res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Authorization: buildAmperAuthHeader(getAmperApiToken()),
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: AmperApiSuccess<T> | AmperApiErrorBody | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as AmperApiSuccess<T> | AmperApiErrorBody;
      } catch {
        throw new AmperApiError(
          `Amper API returned invalid JSON (${res.status})`,
          "AMPER_INVALID_RESPONSE",
          res.status || 502,
        );
      }
    }

    if (!json) {
      throw new AmperApiError(`Amper API empty response (${res.status})`, "AMPER_EMPTY", res.status);
    }

    if (!json.success) {
      throw mapAmperError(json as AmperApiErrorBody);
    }

    return (json as AmperApiSuccess<T>).data;
  } catch (err) {
    if (err instanceof AmperApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AmperApiError("Amper API request timed out", "AMPER_TIMEOUT", 504);
    }
    throw new AmperApiError(
      err instanceof Error ? err.message : "Amper API request failed",
      "AMPER_NETWORK",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
