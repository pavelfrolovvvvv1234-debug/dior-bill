import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@dior/database";
import { verifySessionToken, COOKIE_NAME, touchUserPresence } from "@dior/backend";

export type SessionUser = {
  id: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
  status: string;
  balance: unknown;
  theme: string;
  locale: string;
};

export type AppSession = {
  user: SessionUser;
  sessionId: string;
};

/** Deduped per request — layout + page share one DB round-trip */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const row = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          avatarUrl: true,
          status: true,
          balance: true,
          theme: true,
          locale: true,
        },
      },
    },
  });

  if (!row?.user || row.user.status !== "ACTIVE") return null;

  void touchUserPresence(row.user.id, row.id).catch(() => {});

  const { balance, ...rest } = row.user;
  return {
    user: {
      ...rest,
      balance: balance == null ? 0 : Number(balance),
    },
    sessionId: row.id,
  };
});

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    const cookieStore = await cookies();
    if (cookieStore.get(COOKIE_NAME)?.value) {
      redirect("/api/auth/clear-session");
    }
    redirect("/login");
  }
  return session;
}

export { getControlSession, requireControlSession, type ControlUser } from "./control-auth";
