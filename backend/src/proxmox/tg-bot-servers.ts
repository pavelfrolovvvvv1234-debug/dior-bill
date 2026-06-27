import { prisma } from "@dior/database";

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export type TelegramBotServerRow = {
  externalId: string;
  vmid: number | null;
  ip: string | null;
  hostname: string | null;
  login: string | null;
  password: string | null;
  status: string | null;
  customerRef: string | null;
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === key.toLowerCase() && v != null && String(v).trim()) {
        return String(v).trim();
      }
    }
  }
  return null;
}

function pickInt(row: Record<string, unknown>, keys: string[]): number | null {
  const raw = pickString(row, keys);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeBotServerRow(row: Record<string, unknown>): TelegramBotServerRow | null {
  const ipRaw = pickString(row, ["ip", "primary_ip", "address", "ipv4"]);
  const ip = ipRaw && IPV4.test(ipRaw) ? ipRaw : null;
  const vmid = pickInt(row, ["vmid", "proxmox_vmid", "vm_id"]);
  const externalId =
    pickString(row, ["id", "server_id", "service_id", "external_id"]) ??
    (vmid != null ? String(vmid) : ip);
  if (!externalId && vmid == null && !ip) return null;

  return {
    externalId: externalId ?? `row-${vmid ?? ip}`,
    vmid,
    ip,
    hostname: pickString(row, ["hostname", "name", "label", "host"]),
    login: pickString(row, ["login", "username", "user", "root_user", "ciuser"]),
    password: pickString(row, ["password", "root_password", "pass", "root_pass"]),
    status: pickString(row, ["status", "state"]),
    customerRef: pickString(row, [
      "telegram_id",
      "user_id",
      "customer_id",
      "client_id",
      "tg_id",
      "email",
    ]),
  };
}

function isSafeSelectSql(sql: string): boolean {
  if (!/^\s*select\s+/i.test(sql)) return false;
  if (/;|--|\/\*|\b(insert|update|delete|drop|alter|create|truncate)\b/i.test(sql)) {
    return false;
  }
  return true;
}

/**
 * Load VPS sold via Telegram bot (credentials + vmid) from read-only SQL.
 * Example .env:
 *   TELEGRAM_BOT_SERVERS_SQL=SELECT id, vmid, ip, login, password, hostname, status FROM dior_bot.servers WHERE vmid IS NOT NULL
 */
export async function collectTelegramBotServersFromDatabase(): Promise<TelegramBotServerRow[]> {
  const sql =
    process.env.TELEGRAM_BOT_SERVERS_SQL?.trim() ||
    process.env.TELEGRAM_BOT_IPS_SQL?.trim();
  if (!sql) return [];

  if (!isSafeSelectSql(sql)) {
    console.warn("[tg-bot] TELEGRAM_BOT_SERVERS_SQL must be a safe SELECT query");
    return [];
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    const out: TelegramBotServerRow[] = [];
    for (const row of rows) {
      const parsed = normalizeBotServerRow(row);
      if (parsed) out.push(parsed);
    }
    if (out.length > 0) {
      console.log(`[tg-bot] loaded ${out.length} server row(s) from bot DB`);
    }
    return out;
  } catch (err) {
    console.warn(
      "[tg-bot] TELEGRAM_BOT_SERVERS_SQL failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
