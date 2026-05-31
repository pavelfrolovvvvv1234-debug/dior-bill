# Dior Cloud — Enterprise Billing Platform

Premium infrastructure billing platform for bulletproof hosting providers. Built with Next.js 15, TypeScript, Prisma (MySQL), Redis queues, and a modular service architecture.

## Architecture

```
apps/
  web/          # Customer dashboard (port 3000)
  admin/        # Enterprise admin panel (port 3001)
  api/          # REST API + webhooks (port 3002)
backend/        # Service layer (auth, billing, VPS, CDN, …)
packages/
  database/     # Prisma schema + client
  shared/       # Types, constants, utilities
```

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (MySQL + Redis)

### 1. Environment

```bash
cp .env.example .env
```

### 2. Start infrastructure

```bash
docker compose up -d mysql redis
```

### 3. Install & database

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### 4. Run development

```bash
# Terminal 1 — API
pnpm --filter @dior/api dev

# Terminal 2 — Worker
pnpm --filter @dior/api worker

# Terminal 3 — Web dashboard
pnpm --filter @dior/web dev

# Terminal 4 — Admin (optional)
pnpm --filter @dior/admin dev
```

### Demo credentials

| Role  | Email            | Password   |
|-------|------------------|------------|
| Admin | admin@dior.cloud | admin123!  |
| User  | demo@dior.cloud  | demo123!   |

## Features

- **Auth**: Email/password, Telegram Login, sessions, 2FA-ready, login history, device tracking
- **VPS**: Proxmox-ready provisioning queue, metrics, reboot/reinstall/rescue
- **Dedicated**: Inventory, stock alerts, IPMI placeholder
- **Domains & CDN**: Management UI with Cloudflare-style analytics
- **Billing**: Invoices, balance, promo codes, auto-renew, partial payments
- **Payments**: Crypto/manual/Telegram abstraction + webhooks
- **Referrals**: Tiers, earnings per referral, payouts
- **Notifications**: In-app, Telegram, email-ready, quiet hours
- **Infrastructure feed**: Live operator updates
- **Support**: Ticket threads, priorities, canned responses
- **Admin**: Users, services, analytics (MRR, churn, node load)

## Production

```bash
docker compose up -d
pnpm build
```

Set strong `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, and `TELEGRAM_BOT_TOKEN` in production.

## Stack

Next.js 15 · TypeScript strict · Tailwind CSS 4 · shadcn/ui patterns · Framer Motion · TanStack Query · Zustand · Prisma · MySQL · Redis · Docker
