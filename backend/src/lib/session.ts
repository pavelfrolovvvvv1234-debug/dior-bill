import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "@dior/shared";

const COOKIE_NAME = "dior_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production-min-32";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
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

export { COOKIE_NAME, SESSION_TTL };
