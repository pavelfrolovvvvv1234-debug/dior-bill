/** Bulletproof VPS default included network speed (Mbps). */
export const BP_NETWORK_BASE_MBPS = 150;

/** Maximum configurable network speed (Mbps). */
export const BP_NETWORK_MAX_MBPS = 1000;

/** Step between speed tiers (Mbps). */
export const BP_NETWORK_STEP_MBPS = 100;

/** Monthly price per 100 Mbps above the base speed (USD). */
export const BP_NETWORK_BLOCK_PRICE_USD = 8;

/** Selectable network speeds for bulletproof VPS (150 Mbps … 1 Gbps). */
export function listBpNetworkSpeedOptions(): number[] {
  const options: number[] = [];
  for (let mbps = BP_NETWORK_BASE_MBPS; mbps < BP_NETWORK_MAX_MBPS; mbps += BP_NETWORK_STEP_MBPS) {
    options.push(mbps);
  }
  options.push(BP_NETWORK_MAX_MBPS);
  return options;
}

/** Monthly surcharge for network speed above the included base. */
export function calcBpNetworkMonthlyAddon(networkMbps: number): number {
  if (networkMbps <= BP_NETWORK_BASE_MBPS) return 0;
  const blocks = Math.floor((networkMbps - BP_NETWORK_BASE_MBPS) / BP_NETWORK_STEP_MBPS);
  return blocks * BP_NETWORK_BLOCK_PRICE_USD;
}

export function isValidBpNetworkMbps(networkMbps: number): boolean {
  return listBpNetworkSpeedOptions().includes(networkMbps);
}

/** Coerce form/API input to a valid bulletproof network speed. */
export function normalizeBpNetworkMbps(raw: unknown): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return BP_NETWORK_BASE_MBPS;
  if (isValidBpNetworkMbps(parsed)) return parsed;
  const options = listBpNetworkSpeedOptions();
  const clamped = Math.min(BP_NETWORK_MAX_MBPS, Math.max(BP_NETWORK_BASE_MBPS, parsed));
  let nearest = options[0];
  let minDiff = Math.abs(clamped - nearest);
  for (const option of options) {
    const diff = Math.abs(clamped - option);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = option;
    }
  }
  return nearest;
}
