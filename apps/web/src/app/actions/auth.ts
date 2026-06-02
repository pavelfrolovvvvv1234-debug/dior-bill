"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, register, loginWithTelegram, logout } from "@dior/backend";
import { COOKIE_NAME, SESSION_TTL, verifySessionToken } from "@dior/backend";
import { AppError } from "@dior/shared";

export type LoginActionResult =
  | {
      ok: true;
      user: { id: string; email: string | null; role: string; avatarUrl: string | null };
    }
  | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const { token, user } = await login({ email, password });
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL,
      path: "/",
    });
    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message };
    }
    console.error("[loginAction]", err);
    return { ok: false, error: "Login failed. Please try again." };
  }
}

export async function registerAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const referralCode = formData.get("referralCode") as string | undefined;
  const { token, user } = await register({
    email,
    password,
    referralCode: referralCode || undefined,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function telegramLoginAction(
  data: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  },
  referralCode?: string,
) {
  const { headers } = await import("next/headers");
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
  const userAgent = h.get("user-agent") ?? undefined;

  const { token, user } = await loginWithTelegram({
    ...data,
    referralCode: referralCode?.trim() || undefined,
    ipAddress,
    userAgent,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  };
}

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
  redirect("/login");
}
