/**
 * Standard VPS (HostVDS) — base amount → sell USD with tiered markup.
 * Shared by web catalog and backend billing so prices cannot drift.
 *
 * Base = unique catalog ladder (was the old sell / list price).
 * Markup (наценка от суммы):
 *   0–2  → +120% (×2.2)
 *   2–4  → +100% (×2.0)
 *   4–10 → +70%  (×1.7)
 *   10+  → +50%  (×1.5)
 */

/** Unique base amounts per plan (ascending; no duplicates). */
export const DEFAULT_HOSTVDS_COST_EUR: Record<string, number> = {
  "0": 2,
  "1": 4,
  "2": 8,
  "3": 30,
  "4": 45,
  "5": 60,
  "6": 75,
  "7": 120,
  "8": 150,
  "9": 180,
  "std-1": 2,
  "std-2": 4,
  "std-3": 8,
  "std-4": 30,
  "std-5": 45,
  "std-6": 60,
  "std-7": 75,
  "std-8": 120,
  "std-9": 150,
  "std-10": 180,
};

export function hostVdsMarkupMultiplier(base: number): number {
  if (base < 2) return 2.2; // +120%  (0 … <2)
  if (base <= 4) return 2.0; // +100%  (2 … 4)
  if (base < 10) return 1.7; // +70%   (>4 … <10)
  return 1.5; // +50%  (≥10)
}

/** sell = round(base × markup × EUR_USD) */
export function calcHostVdsSellPrice(base: number, eurUsd = 1): number {
  return Math.round(base * hostVdsMarkupMultiplier(base) * eurUsd);
}

export function resolveHostVdsSellPriceFromCostMap(
  planId: string,
  costMap: Record<string, number> = DEFAULT_HOSTVDS_COST_EUR,
  eurUsd = 1,
): number | null {
  const cost = costMap[planId];
  if (typeof cost !== "number" || !Number.isFinite(cost)) return null;
  return calcHostVdsSellPrice(cost, eurUsd);
}
