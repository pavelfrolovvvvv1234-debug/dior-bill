import { prisma } from "@dior/database";

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function extractIpFromRow(row: Record<string, unknown>): string | null {
  for (const value of Object.values(row)) {
    if (typeof value === "string") {
      const ip = value.trim();
      if (IPV4.test(ip)) return ip;
    }
  }
  return null;
}

/**
 * Load IPs sold via Telegram bot from a read-only SQL query (same MySQL host or cross-DB).
 * Example .env:
 *   TELEGRAM_BOT_IPS_SQL=SELECT ip FROM dior_bot.servers WHERE ip IS NOT NULL AND status='active'
 */
export async function collectTelegramBotIpsFromDatabase(): Promise<string[]> {
  const sql = process.env.TELEGRAM_BOT_IPS_SQL?.trim();
  if (!sql) return [];

  if (!/^\s*select\s+/i.test(sql)) {
    console.warn("[ip-pool] TELEGRAM_BOT_IPS_SQL must be a SELECT query");
    return [];
  }
  if (/;|--|\/\*|\b(insert|update|delete|drop|alter|create|truncate)\b/i.test(sql)) {
    console.warn("[ip-pool] TELEGRAM_BOT_IPS_SQL rejected (unsafe SQL)");
    return [];
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    const ips = new Set<string>();
    for (const row of rows) {
      const ip = extractIpFromRow(row);
      if (ip) ips.add(ip);
    }
    if (ips.size > 0) {
      console.log(`[ip-pool] Telegram bot DB: ${ips.size} IPs marked as reserved`);
    }
    return [...ips];
  } catch (err) {
    console.warn(
      "[ip-pool] TELEGRAM_BOT_IPS_SQL failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
