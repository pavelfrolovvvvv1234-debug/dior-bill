#!/usr/bin/env bash
# One-shot fix: sync schema + clear login rate limits (after a baseline-only deploy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Syncing database schema with Prisma…" >&2
pnpm --filter @dior/database push

echo "→ Clearing login rate limits…" >&2
pnpm --filter @dior/database exec dotenv -e ../../.env -- prisma db execute --stdin <<'SQL'
DELETE FROM `rate_limit_entries` WHERE `key` LIKE 'login:%';
SQL

echo "Done. Restart web: pm2 restart dior-web" >&2
