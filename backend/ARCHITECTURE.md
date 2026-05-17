# Dior Control Plane — Production Architecture Freeze

Event-sourced infrastructure orchestration with strict ownership boundaries.

## Source of Truth

| Domain | Owner | Store |
|--------|-------|-------|
| Service lifecycle | `core/provisioning/engine` | `services` + `domain_events` |
| Invoice / payment | `core/billing/engine` | `invoices` / `top_ups` + `domain_events` |
| Node / IP / capacity | `core/inventory/service` | `nodes` / `ip_addresses` + `domain_events` |
| History | `core/events/store` | `domain_events` (append-only) |
| Risk / abuse | `core/abuse/engine` | `user_risk_profiles` + events |

## Rules

1. **No cross-service writes** — billing never sets `service.status`; provisioning never marks invoices paid.
2. **Activation only via `payment.confirmed`** — provisioning starts in event handler.
3. **All mutations emit domain events** — immutable, idempotent, replayable.
4. **UI uses read models only** — `activity_read_model`, `service_timeline_read_model`.
5. **Workers are stateless** — dedupe via `processed_idempotency_keys`.

## Lifecycle FSM

`PENDING → PROVISIONING → ACTIVE → SUSPENDED → DELETED`

Transient: `FAILED`, `ROLLBACK`, `REINSTALLING`, `SNAPSHOTTING`

## Reconciliation (self-heal)

- `billing_service` — pending services with paid invoices
- `inventory_capacity` — node IPv4 / capacity counters
- `provisioning_proxmox` — stuck / ghost VMs
- `ip_allocation` — orphaned IP assignments

## Failure Model

| Failure | Behavior |
|---------|----------|
| Partial provision | Rollback IP + `ROLLBACK`/`FAILED` + compensating events |
| Payment delay | `billing.grace_period` event — no activation |
| Worker crash | Replay-safe idempotency keys |
| Proxmox error | Retry job; no duplicate VM on replay |

## Phase 2 enforcement

- All invoice mutations → `core/billing/invoice-engine.ts`
- Service lifecycle → `core/provisioning/engine.ts` only
- IP/capacity → `core/inventory/service.ts` only
- Webhooks → `core/billing/payment-confirmation.ts`
- Admin → `core/admin/control.ts` (audit + domain events)
- Replay CLI → `pnpm --filter @dior/backend event-replay rebuild-read-models`

## Env

- `BILLING_AUTO_PROVISION=true` — demo: pay from balance and auto-emit payment.confirmed
