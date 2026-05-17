export type TelegramSendResult =
  | { ok: true }
  | { ok: false; reason: string };

function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export async function sendTelegramMessage(
  chatId: string | number | bigint,
  text: string,
  options?: { parse_mode?: "HTML" | "Markdown" },
): Promise<TelegramSendResult> {
  const token = getBotToken();
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN not set" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.toString(),
        text,
        parse_mode: options?.parse_mode ?? "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, reason: data.description ?? "Telegram API error" };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Telegram request failed",
    };
  }
}

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
