/**
 * Standard VPS (HostVDS) sell price from EUR cost + tiered markup.
 * Bulletproof / Proxmox prices are unrelated.
 */

export const DEFAULT_HOSTVDS_COST_EUR: Record<string, number> = {
  "0": 0.99,
  "1": 3.99,
  "2": 3.99,
  "3": 19.99,
  "4": 39.99,
  "5": 39.99,
  "6": 39.99,
  "7": 79.99,
  "8": 119.99,
  "9": 119.99,
  "std-1": 0.99,
  "std-2": 3.99,
  "std-3": 3.99,
  "std-4": 19.99,
  "std-5": 39.99,
  "std-6": 39.99,
  "std-7": 39.99,
  "std-8": 79.99,
  "std-9": 119.99,
  "std-10": 119.99,
};

export function hostVdsMarkupMultiplier(costEur: number): number {
  if (costEur < 2) return 2.2; // +120%
  if (costEur < 4) return 2.0; // +100%
  if (costEur < 10) return 1.7; // +70%
  return 1.5; // +50%
}

export function getHostVdsEurUsd(): number {
  const n = Number(process.env.HOSTVDS_EUR_USD ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseCostMap(): Record<string, number> {
  const raw = process.env.HOSTVDS_COST_EUR_MAP?.trim();
  if (!raw) return { ...DEFAULT_HOSTVDS_COST_EUR };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = { ...DEFAULT_HOSTVDS_COST_EUR };
    for (const [k, v] of Object.entries(parsed)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  } catch {
    return { ...DEFAULT_HOSTVDS_COST_EUR };
  }
}

export function getHostVdsCostEur(planId: string): number | null {
  const map = parseCostMap();
  const v = map[planId];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** sell = round(costEur * markupMultiplier * EUR_USD) */
export function calcHostVdsSellPrice(costEur: number, eurUsd = getHostVdsEurUsd()): number {
  return Math.round(costEur * hostVdsMarkupMultiplier(costEur) * eurUsd);
}

export function resolveHostVdsSellPrice(planId: string): number | null {
  const cost = getHostVdsCostEur(planId);
  if (cost == null) return null;
  return calcHostVdsSellPrice(cost);
}
