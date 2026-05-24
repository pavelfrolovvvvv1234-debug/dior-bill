"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, logout, verifySessionToken } from "@dior/backend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload) {
      await logout(payload.sessionId, payload.userId).catch(() => undefined);
    }
  }

  cookieStore.delete(COOKIE_NAME);
  redirect(`${APP_URL}/login?redirect=${encodeURIComponent(ADMIN_URL)}`);
}
