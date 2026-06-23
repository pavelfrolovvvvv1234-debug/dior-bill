#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git pull origin main
pnpm install
pnpm deploy:prod

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart dior-web dior-worker 2>/dev/null || pm2 restart dior-web || pm2 restart all
fi

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  docker compose up -d api worker
fi

echo "Deploy complete."
