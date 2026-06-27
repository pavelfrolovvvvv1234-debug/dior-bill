import { jwtVerify } from "jose";

/** Must match backend/src/lib/session.ts — edge-safe copy for middleware. */
export const COOKIE_NAME = "dior_session";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production-min-32";
  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; sessionId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      sessionId: payload.sessionId as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}
