/**
 * HostVDS cost → sell price (markup tiers).
 * Cost map + formula live in @dior/shared; env overrides stay here.
 */
import {
  DEFAULT_HOSTVDS_COST_EUR,
  calcHostVdsSellPrice,
  hostVdsMarkupMultiplier,
  resolveHostVdsSellPriceFromCostMap,
} from "@dior/shared";

export {
  DEFAULT_HOSTVDS_COST_EUR,
  calcHostVdsSellPrice,
  hostVdsMarkupMultiplier,
};

function parseCostMap(raw: string | undefined): Record<string, number> {
  if (!raw?.trim()) return { ...DEFAULT_HOSTVDS_COST_EUR };
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

export function getHostVdsCostEurMap(): Record<string, number> {
  return parseCostMap(process.env.HOSTVDS_COST_EUR_MAP);
}

export function getHostVdsEurUsd(): number {
  const n = Number(process.env.HOSTVDS_EUR_USD ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Resolve sell USD for HostVDS plan; null if unknown plan. */
export function resolveHostVdsSellPrice(planId: string): number | null {
  return resolveHostVdsSellPriceFromCostMap(planId, getHostVdsCostEurMap(), getHostVdsEurUsd());
}
