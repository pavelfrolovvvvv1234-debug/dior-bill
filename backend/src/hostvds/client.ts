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

type CatalogEndpoint = { interface: string; region?: string; url: string };
type CatalogEntry = { type: string; name?: string; endpoints: CatalogEndpoint[] };

type AuthSession = {
  mode: "keystone" | "static";
  token: string;
  catalog: CatalogEntry[];
  expiresAt: number;
  /** Static-token mode only (single region). */
  staticComputeUrl: string | null;
  staticImageUrl: string | null;
  staticNetworkUrl: string | null;
};

let cachedAuth: AuthSession | null = null;

export function pickEndpoint(
  catalog: CatalogEntry[],
  type: string,
  region: string,
): string | null {
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

/** Unique region ids that expose a public compute endpoint. */
export function listComputeRegionsFromCatalog(catalog: CatalogEntry[]): string[] {
  const entry = catalog.find((c) => c.type === "compute");
  if (!entry?.endpoints?.length) return [];
  const regions = new Set<string>();
  for (const ep of entry.endpoints) {
    if (ep.interface === "public" && ep.region?.trim()) {
      regions.add(ep.region.trim());
    }
  }
  return [...regions].sort();
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

    const session: AuthSession = {
      mode: "keystone",
      token,
      catalog,
      expiresAt: Date.now() + 50 * 60 * 1000,
      staticComputeUrl: null,
      staticImageUrl: null,
      staticNetworkUrl: null,
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
      mode: "static",
      token: staticToken,
      catalog: [],
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      staticComputeUrl: staticBase,
      staticImageUrl: process.env.HOSTVDS_IMAGE_API_BASE_URL?.trim()?.replace(/\/$/, "") || null,
      staticNetworkUrl: process.env.HOSTVDS_NETWORK_API_BASE_URL?.trim()?.replace(/\/$/, "") || null,
    };
  }

  if (cachedAuth && cachedAuth.mode === "keystone" && cachedAuth.expiresAt > Date.now() + 60_000) {
    return cachedAuth;
  }
  return authenticateKeystone();
}

function serviceBaseUrl(auth: AuthSession, service: HostVdsService, region: string): string {
  if (auth.mode === "static") {
    if (service === "compute") {
      if (!auth.staticComputeUrl) {
        throw new HostVdsApiError("HostVDS compute URL missing", "HOSTVDS_NO_COMPUTE", 503);
      }
      return auth.staticComputeUrl;
    }
    if (service === "image") {
      if (!auth.staticImageUrl) {
        throw new HostVdsApiError(
          "HostVDS Glance (image) endpoint missing — set HOSTVDS_IMAGE_API_BASE_URL",
          "HOSTVDS_NO_IMAGE",
          503,
        );
      }
      return auth.staticImageUrl;
    }
    if (!auth.staticNetworkUrl) {
      throw new HostVdsApiError(
        "HostVDS Neutron (network) endpoint missing — set HOSTVDS_NETWORK_API_BASE_URL",
        "HOSTVDS_NO_NETWORK",
        503,
      );
    }
    return auth.staticNetworkUrl;
  }

  const url = pickEndpoint(auth.catalog, service, region);
  if (!url) {
    throw new HostVdsApiError(
      `HostVDS ${service} endpoint missing for region=${region}`,
      service === "compute"
        ? "HOSTVDS_NO_COMPUTE"
        : service === "image"
          ? "HOSTVDS_NO_IMAGE"
          : "HOSTVDS_NO_NETWORK",
      503,
    );
  }
  return url;
}

export async function hostVdsListComputeRegions(): Promise<string[]> {
  const auth = await resolveAuth();
  if (auth.mode === "static") {
    return [getHostVdsRegion()];
  }
  const regions = listComputeRegionsFromCatalog(auth.catalog);
  return regions.length > 0 ? regions : [getHostVdsRegion()];
}

export async function hostVdsRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    retryAuth?: boolean;
    service?: HostVdsService;
    /** OpenStack region (defaults to HOSTVDS_REGION_NAME). */
    region?: string;
  } = {},
): Promise<T> {
  if (!isHostVdsConfigured()) {
    throw new HostVdsApiError("HostVDS is not configured", "HOSTVDS_NOT_CONFIGURED", 503);
  }

  const auth = await resolveAuth();
  const service = options.service ?? "compute";
  const region = options.region?.trim() || getHostVdsRegion();
  const base = serviceBaseUrl(auth, service, region);
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
