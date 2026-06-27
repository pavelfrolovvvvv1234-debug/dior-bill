# Shared IP registry (TG bot + web billing)

Single source of truth: table `network_ip_allocations` in **one MySQL** (`dior_billing`).

## Columns (bot + billing)

| Column | TG bot | Billing |
|--------|--------|---------|
| `ip` | UNIQUE | UNIQUE |
| `owner` | `telegram_bot` | `billing` |
| `status` | reserved → active → released | same |
| `vmid` | Proxmox VMID | Proxmox VMID |
| `external_service_id` | bot service id | — |
| `vps_id` | — | billing VPS id |
| `hostname` | optional | optional |

## Billing flow

1. `reserveBillingIpInSharedRegistry` — INSERT/UPDATE `owner=billing`, `status=reserved`
2. Proxmox clone + `ipconfig0`
3. `activateSharedRegistryIp` — `status=active`, set `vmid`
4. On delete/cancel/failed rollback — `teardownVpsNetworkResources` → `released`

## Worker maintenance (automatic when registry enabled)

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
```

Do **not** enable registry on billing only — bot must write too.

## Cutover (one day)

```bash
# 1. Migration
cd packages/database && pnpm migrate:deploy

# 2. Seed existing IPs from Proxmox
cd backend
pnpm run sync-shared-ip-registry -- --dry-run
pnpm run sync-shared-ip-registry

# 3. Enable registry in .env (bot + billing), restart both
pm2 restart dior-worker dior-web dior-host-bot --update-env

# 4. Verify
pnpm run reconcile-shared-ip-registry
```

```sql
SELECT owner, status, COUNT(*) FROM network_ip_allocations
WHERE network = '45.74.7.0/24' GROUP BY owner, status;
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm run sync-shared-ip-registry` | One-time import from Proxmox |
| `pnpm run reconcile-shared-ip-registry` | Ghost VM cleanup + import |

## Bot table created first?

If bot ran `CREATE TABLE` without `vps_id`:

```sql
ALTER TABLE network_ip_allocations ADD COLUMN vps_id VARCHAR(191) NULL;
ALTER TABLE network_ip_allocations ADD COLUMN hostname VARCHAR(255) NULL;
ALTER TABLE network_ip_allocations ADD COLUMN notes TEXT NULL;
```

If billing migration ran first, bot only needs `external_service_id` (already in schema).
