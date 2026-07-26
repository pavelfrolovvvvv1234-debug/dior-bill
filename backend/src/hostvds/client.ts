import { AppError } from "@dior/shared";
import {
  getHostVdsApiBaseUrl,
  getHostVdsApiToken,
  getHostVdsAuthUrl,
  getHostVdsKeystoneConfig,
  getHostVdsRegion,
  getHostVdsTimeoutMs,
  isHostVdsConfigured,
} from "./config";

export class HostVdsApiError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode = 502,
    public readonly details?: unknown,
  ) {
    super(message, code, statusCode);
    this.name = "HostVdsApiError";
  }
}

export type HostVdsService = "compute" | "image" | "network";

type AuthSession = {
  token: string;
  computeUrl: string;
  imageUrl: string | null;
  networkUrl: string | null;
  expiresAt: number;
};

let cachedAuth: AuthSession | null = null;

type CatalogEndpoint = { interface: string; region?: string; url: string };
type CatalogEntry = { type: string; name?: string; endpoints: CatalogEndpoint[] };

function pickEndpoint(catalog: CatalogEntry[], type: string, region: string): string | null {
  const entry =
    catalog.find((c) => c.type === type) ??
    catalog.find((c) => c.name?.toLowerCase().includes(type));
  if (!entry?.endpoints?.length) return null;
  const publicEps = entry.endpoints.filter((ep) => ep.interface === "public");
  const match =
    publicEps.find((ep) => ep.region === region) ??
    publicEps.find((ep) => !ep.region || ep.region === region) ??
    publicEps[0];
  return match?.url?.replace(/\/$/, "") ?? null;
}

async function authenticateKeystone(): Promise<AuthSession> {
  const cfg = getHostVdsKeystoneConfig();
  if (!cfg) {
    throw new HostVdsApiError("HostVDS Keystone is not configured", "HOSTVDS_NOT_CONFIGURED", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getHostVdsTimeoutMs());
  try {
    const res = await fetch(`${cfg.authUrl}/auth/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        auth: {
          identity: {
            methods: ["password"],
            password: {
              user: {
                name: cfg.username,
                domain: { name: cfg.userDomain },
                password: cfg.password,
              },
            },
          },
          scope: {
            project: {
              name: cfg.projectName,
              domain: { name: cfg.projectDomain },
            },
          },
        },
      }),
      signal: controller.signal,
    });

    const token = res.headers.get("X-Subject-Token");
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new HostVdsApiError("HostVDS auth returned invalid JSON", "HOSTVDS_AUTH_JSON", 502);
      }
    }

    if (!res.ok || !token) {
      const msg =
        json && typeof json === "object" && "error" in json
          ? String((json as { error?: { message?: string } }).error?.message ?? "Auth failed")
          : `HostVDS auth failed (${res.status})`;
      throw new HostVdsApiError(msg, "HOSTVDS_AUTH", res.status || 401);
    }

    const tokenBody =
      json && typeof json === "object" && "token" in json
        ? (json as { token?: { catalog?: CatalogEntry[] } }).token
        : undefined;
    const catalog: CatalogEntry[] = Array.isArray(tokenBody?.catalog) ? tokenBody.catalog : [];
    const region = getHostVdsRegion();

    let computeUrl = getHostVdsApiBaseUrl();
    if (!computeUrl) {
      computeUrl = pickEndpoint(catalog, "compute", region);
    }
    if (!computeUrl) {
      throw new HostVdsApiError(
        `HostVDS compute URL missing for region=${region} — set HOSTVDS_API_BASE_URL or check Keystone catalog`,
        "HOSTVDS_NO_COMPUTE",
        503,
      );
    }

    const session: AuthSession = {
      token,
      computeUrl,
      imageUrl: pickEndpoint(catalog, "image", region),
      networkUrl: pickEndpoint(catalog, "network", region),
      expiresAt: Date.now() + 50 * 60 * 1000,
    };
    cachedAuth = session;
    return session;
  } catch (err) {
    if (err instanceof HostVdsApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HostVdsApiError("HostVDS auth timed out", "HOSTVDS_TIMEOUT", 504);
    }
    throw new HostVdsApiError(
      err instanceof Error ? err.message : "HostVDS auth failed",
      "HOSTVDS_AUTH_NETWORK",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAuth(): Promise<AuthSession> {
  const staticToken = getHostVdsApiToken();
  const staticBase = getHostVdsApiBaseUrl();
  if (staticToken && staticBase) {
    return {
      token: staticToken,
      computeUrl: staticBase,
      imageUrl: process.env.HOSTVDS_IMAGE_API_BASE_URL?.trim()?.replace(/\/$/, "") || null,
      networkUrl: process.env.HOSTVDS_NETWORK_API_BASE_URL?.trim()?.replace(/\/$/, "") || null,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  if (cachedAuth && cachedAuth.expiresAt > Date.now() + 60_000) {
    return cachedAuth;
  }
  return authenticateKeystone();
}

function serviceBaseUrl(auth: AuthSession, service: HostVdsService): string {
  if (service === "compute") return auth.computeUrl;
  if (service === "image") {
    if (!auth.imageUrl) {
      throw new HostVdsApiError(
        "HostVDS Glance (image) endpoint missing in Keystone catalog — set HOSTVDS_IMAGE_API_BASE_URL",
        "HOSTVDS_NO_IMAGE",
        503,
      );
    }
    return auth.imageUrl;
  }
  if (!auth.networkUrl) {
    throw new HostVdsApiError(
      "HostVDS Neutron (network) endpoint missing in Keystone catalog — set HOSTVDS_NETWORK_API_BASE_URL",
      "HOSTVDS_NO_NETWORK",
      503,
    );
  }
  return auth.networkUrl;
}

export async function hostVdsRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    retryAuth?: boolean;
    service?: HostVdsService;
  } = {},
): Promise<T> {
  if (!isHostVdsConfigured()) {
    throw new HostVdsApiError("HostVDS is not configured", "HOSTVDS_NOT_CONFIGURED", 503);
  }

  const auth = await resolveAuth();
  const service = options.service ?? "compute";
  const base = serviceBaseUrl(auth, service);
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${pathNorm}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getHostVdsTimeoutMs());

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "X-Auth-Token": auth.token,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401 && options.retryAuth !== false && getHostVdsAuthUrl()) {
      cachedAuth = null;
      return hostVdsRequest<T>(path, { ...options, retryAuth: false });
    }

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        if (!res.ok) {
          throw new HostVdsApiError(`HostVDS error (${res.status})`, "HOSTVDS_HTTP", res.status);
        }
        return {} as T;
      }
    }

    if (!res.ok) {
      const message =
        json && typeof json === "object"
          ? String(
              (json as { error?: { message?: string }; message?: string; itemNotFound?: { message?: string } })
                .error?.message ??
                (json as { message?: string }).message ??
                (json as { itemNotFound?: { message?: string } }).itemNotFound?.message ??
                `HostVDS error (${res.status})`,
            )
          : `HostVDS error (${res.status})`;
      throw new HostVdsApiError(message, "HOSTVDS_HTTP", res.status, json);
    }

    return (json ?? {}) as T;
  } catch (err) {
    if (err instanceof HostVdsApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HostVdsApiError("HostVDS request timed out", "HOSTVDS_TIMEOUT", 504);
    }
    throw new HostVdsApiError(
      err instanceof Error ? err.message : "HostVDS request failed",
      "HOSTVDS_NETWORK",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function clearHostVdsAuthCache(): void {
  cachedAuth = null;
}
