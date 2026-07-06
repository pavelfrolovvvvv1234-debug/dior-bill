# Shared IP registry (TG bot + web billing)

Single source of truth: table `network_ip_allocations` in **one MySQL** (`dior_billing`).

Both **web billing** (this repo) and **TG bot** (dior-bot) must use the same table before enabling `PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1`.

## Implementation status (billing)

| Deliverable | Status | Location |
|-------------|--------|----------|
| Prisma model + migration | Done | `packages/database/prisma/schema.prisma`, migration `20260627120000_network_ip_allocations` |
| reserve / activate / release | Done | `backend/src/proxmox/shared-ip-registry.ts` |
| FOR UPDATE transaction on reserve | Done | `reserveBillingIpInSharedRegistry` |
| released IP reuse (UPDATE not INSERT) | Done | same file |
| Integrate in VPS create flow | Done | `ip-allocate.ts` → `state-machine.ts` activate |
| Release on delete/cancel/rollback | Done | `vps-network-teardown.ts`, `state-machine.ts` rollback |
| sync-proxmox-used-ips reads registry first | Done | `collectAllUsedProxmoxIps` in `ip-allocate.ts` |
| Stale reserved cleanup (30m) | Done | worker every 5m |
| Proxmox reconcile job | Done | worker every 24h |
| Seed script | Done | `pnpm run sync-shared-ip-registry` |
| Unit tests | Done | `backend/src/proxmox/__tests__/shared-ip-registry.test.ts` |

## Columns (bot + billing)

| Column | TG bot | Billing |
|--------|--------|---------|
| `ip` | UNIQUE | UNIQUE |
| `network` | `45.74.7.0/24` | same CIDR always |
| `owner` | `telegram_bot` | `billing` |
| `status` | reserved → active → released | same |
| `vmid` | Proxmox VMID | Proxmox VMID |
| `external_service_id` | bot service id | billing `serviceId` (optional) |
| `vps_id` | — | billing VPS id |
| `hostname` | optional | optional |

## Billing flow

1. `reserveBillingIpInSharedRegistry` — transaction + `SELECT … FOR UPDATE`, then INSERT or UPDATE `released` row
2. Proxmox clone + `ipconfig0` + `agent=1`
3. `activateSharedRegistryIp` — `status=active`, set `vmid`
4. On delete/cancel/failed rollback — `teardownVpsNetworkResources` → `released`

## Worker maintenance (when registry enabled)

| Task | Interval |
|------|----------|
| Stale `reserved` (billing, >30m) → `released` | 5 min |
| Reconcile Proxmox ↔ table (ghost VMIDs, import IPs) | 24 h |

Env: `SHARED_IP_RESERVE_TTL_MINUTES=30` (optional)

## `.env` (enable on **both** bot and billing)

```env
DATABASE_URL=mysql://USER:PASS@HOST:3306/dior_billing
PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1
PROXMOX_NETWORK=45.74.7.0/24
PROXMOX_GATEWAY=45.74.7.1
PROXMOX_IP_START=175
PROXMOX_IP_START=100
PROXMOX_IP_END=250
SHARED_IP_RESERVE_TTL_MINUTES=30
```

When `PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1`:

- **Only** `network_ip_allocations` is used for pick/reserve/next-free
- Legacy `ip_addresses` table is **not** written during VPS create
- Proxmox scan / gap-fill / TG-bot SQL are **disabled** for occupancy
- Optional: during reserve, Proxmox `ipconfig0` scan is merged as safety net (disable with `SHARED_IP_PROXMOX_SCAN_FALLBACK=0`)

Do **not** enable registry on billing only — bot must write too.

## TG bot MySQL user (on billing server)

```sql
CREATE USER 'dior_bot_ip'@'BOT_SERVER_IP' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE ON dior_billing.network_ip_allocations TO 'dior_bot_ip'@'BOT_SERVER_IP';
```

Bot `.env`: `SHARED_IP_DATABASE_URL=mysql://dior_bot_ip:...@billing-host:3306/dior_billing`

## Cutover (one day)

```bash
# 1. Migration
cd packages/database && pnpm migrate:deploy

# 2. Seed existing IPs from Proxmox (registry flag still OFF)
cd backend
pnpm run sync-shared-ip-registry --dry-run
pnpm run sync-shared-ip-registry

# 3. Enable PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1 on bot + billing, restart both
pm2 restart dior-worker dior-web dior-host-bot --update-env

# 4. Verify
pnpm run reconcile-shared-ip-registry
```

```sql
SELECT owner, status, COUNT(*) FROM network_ip_allocations
WHERE network = '45.74.7.0/24' GROUP BY owner, status;
```

Create test VPS from bot and from billing — IPs must not overlap.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm run sync-shared-ip-registry` | One-time import from Proxmox |
| `pnpm run reconcile-shared-ip-registry` | Ghost VM cleanup + import |
| `pnpm run sync-proxmox-used-ips` | Show occupied / next free (uses registry when enabled) |

## What NOT to do

- Do not rely on Proxmox scan only when registry is required
- Do not split subnet zones (.100–.174 / .175+) — table replaces that
- Do not enable `PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1` on only one service

## Bot table created first?

If bot ran `CREATE TABLE` without `vps_id`:

```sql
ALTER TABLE network_ip_allocations ADD COLUMN vps_id VARCHAR(191) NULL;
ALTER TABLE network_ip_allocations ADD COLUMN hostname VARCHAR(255) NULL;
ALTER TABLE network_ip_allocations ADD COLUMN notes TEXT NULL;
```

If billing migration ran first, bot only needs `external_service_id` (already in schema).
