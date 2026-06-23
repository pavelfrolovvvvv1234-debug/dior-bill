#!/usr/bin/env bash
# Apply Prisma migrations on production. Baselines DB once if it was created via db push (P3005).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$ROOT/packages/database"
LOG="$(mktemp)"

cd "$DB_DIR"

run_migrate() {
  dotenv -e ../../.env -- prisma migrate deploy
}

if run_migrate 2>"$LOG"; then
  rm -f "$LOG"
  exit 0
fi

if ! grep -q 'P3005' "$LOG"; then
  cat "$LOG" >&2
  rm -f "$LOG"
  exit 1
fi

echo "Database has no migration history — baselining existing schema (one-time)…" >&2

for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  echo "  mark applied: $name" >&2
  dotenv -e ../../.env -- prisma migrate resolve --applied "$name"
done

run_migrate
rm -f "$LOG"
