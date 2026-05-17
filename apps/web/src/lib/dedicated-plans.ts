export type DedicatedCatalogPlan = {
  id: string;
  price: number;
  /** Short CPU label for compact list rows */
  cpu: string;
  ram: string;
  storage?: string;
  /** Full card layout (bulletproof dedicated) */
  name?: string;
  cpuCores?: number;
  network?: string;
  bandwidth?: string;
};

export function isDedicatedPlanDetailed(
  plan: DedicatedCatalogPlan,
): plan is DedicatedCatalogPlan & {
  name: string;
  cpuCores: number;
  storage: string;
  network: string;
  bandwidth: string;
} {
  return (
    plan.name != null &&
    plan.cpuCores != null &&
    plan.storage != null &&
    plan.network != null &&
    plan.bandwidth != null
  );
}

export const STANDARD_DEDICATED_PLANS: readonly DedicatedCatalogPlan[] = [
  { id: "ded-i7-6700-64", cpu: "i7-6700", ram: "64GB", price: 81 },
  { id: "ded-i7-8700-64", cpu: "i7-8700", ram: "64GB", price: 99 },
  { id: "ded-xeon-e3-64", cpu: "Xeon E3", ram: "64GB", price: 108 },
  { id: "ded-ryzen7-64", cpu: "Ryzen 7", ram: "64GB", price: 126 },
  { id: "ded-ryzen9-64", cpu: "Ryzen 9", ram: "64GB", price: 135 },
  { id: "ded-ryzen9-128", cpu: "Ryzen 9", ram: "128GB", price: 171 },
  { id: "ded-xeon-e3-32", cpu: "Xeon E3", ram: "32GB", price: 72 },
  { id: "ded-2x-xeon-64", cpu: "2x Xeon", ram: "64GB", price: 99 },
  { id: "ded-2x-xeon-144", cpu: "2x Xeon", ram: "144GB", price: 144 },
  { id: "ded-2x-xeon-256", cpu: "2x Xeon", ram: "256GB", price: 198 },
  { id: "ded-2x-xeon-384", cpu: "2x Xeon", ram: "384GB", price: 252 },
  { id: "ded-2x-xeon-512", cpu: "2x Xeon", ram: "512GB", price: 315 },
  { id: "ded-plat-8173-768", cpu: "2x Platinum 8173M", ram: "768GB", price: 405 },
  {
    id: "ded-plat-8168-4tb",
    cpu: "2x Platinum 8168",
    ram: "768GB",
    storage: "4TB",
    price: 720,
  },
  { id: "ded-plat-8168-1024", cpu: "2x Platinum 8168", ram: "1024GB", price: 810 },
];
