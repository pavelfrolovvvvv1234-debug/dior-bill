import { NextRequest, NextResponse } from "next/server";
import { completeTelegramLink, sendTelegramMessage, escapeTelegramHtml } from "@dior/backend";

type TelegramUpdate = {
  message?: {
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
  };
};

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== expected) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const text = update.message?.text?.trim();
  const from = update.message?.from;
  if (!text || !from?.id) {
    return NextResponse.json({ ok: true });
  }

  if (text === "/chatid" || text.startsWith("/chatid@")) {
    await sendTelegramMessage(
      from.id,
      [
        "🆔 <b>Your Telegram chat ID</b>",
        "",
        `<code>${from.id}</code>`,
        "",
        "Add it to <code>TELEGRAM_ADMIN_CHAT_IDS</code> in server env to receive billing & support alerts.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return NextResponse.json({ ok: true });
  }

  if (!text.startsWith("/start")) {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start link_")) {
    const token = text.replace(/^\/start\s+link_/, "").trim();
    if (token) {
      try {
        await completeTelegramLink(token, {
          id: BigInt(from.id),
          username: from.username,
        });
        await sendTelegramMessage(
          from.id,
          "✅ Telegram linked to your DiorHost account. You will receive billing and support alerts here.",
        );
      } catch {
        await sendTelegramMessage(
          from.id,
          "Link expired or invalid. Generate a new link in Settings → Integrations.",
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const payload = text.replace(/^\/start\s*/, "").trim();
  const refCode = payload.startsWith("ref_") ? payload.slice(4) : "";
  const loginUrl = `${appUrl}/login`;
  const registerUrl = refCode ? `${appUrl}/register?ref=${encodeURIComponent(refCode)}` : `${appUrl}/register`;
  const name = escapeTelegramHtml(from.first_name ?? "there");

  await sendTelegramMessage(
    from.id,
    [
      `👋 Hello, <b>${name}</b>!`,
      "",
      "<b>DiorHost</b> — bulletproof hosting & billing.",
      "",
      `🔐 Sign in on the site (Telegram button): ${loginUrl}`,
      refCode ? `📝 Register with your referral: ${registerUrl}` : `📝 New here: ${registerUrl}`,
      "",
      "The same account works on the website and in this bot.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );

  return NextResponse.json({ ok: true });
}
