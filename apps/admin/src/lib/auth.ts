import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@dior/database";
import { verifySessionToken, COOKIE_NAME, ADMIN_ROLES } from "@dior/backend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ControlUser = {
  id: string;
  email: string | null;
  role: string;
  displayName: string | null;
};

export const getControlSession = cache(async (): Promise<ControlUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  if (!ADMIN_ROLES.includes(payload.role as (typeof ADMIN_ROLES)[number])) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, displayName: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

export async function requireControlSession(): Promise<ControlUser> {
  const session = await getControlSession();
  if (!session) redirect(`${APP_URL}/login?redirect=${encodeURIComponent(process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001")}`);
  return session;
}

export function getPortalUrl() {
  return APP_URL;
}
