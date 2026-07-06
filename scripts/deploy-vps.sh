#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git pull origin main
pnpm install
pnpm deploy:prod

if command -v pm2 >/dev/null 2>&1; then
  # --update-env: pick up PROXMOX_* / SHARED_IP_* from .env (required for VPS provision).
  pm2 restart dior-web dior-worker --update-env 2>/dev/null \
    || pm2 restart dior-web --update-env \
    || pm2 restart all --update-env
  # PM2 worker must be the sole job consumer — Docker worker has no Proxmox .env.
  if command -v docker >/dev/null 2>&1; then
    docker stop dior-billing-worker-1 2>/dev/null || docker compose stop worker 2>/dev/null || true
  fi
elif command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  docker compose up -d api worker
fi

echo "Deploy complete."
