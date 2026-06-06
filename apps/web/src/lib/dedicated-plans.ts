export type DedicatedCatalogPlan = {
  id: string;
  price: number;
  /** Short CPU label for compact list rows */
  cpu: string;
  ram: string;
  storage?: string;
  /** Full card layout (bulletproof + standard dedicated) */
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

const STD_NET = { network: "1 Gbps", bandwidth: "Unlimited" } as const;

/** Standard bare-metal — non-abuse-resistant dedicated servers */
export const STANDARD_DEDICATED_PLANS: readonly DedicatedCatalogPlan[] = [
  {
    id: "ded-i7-6700-64",
    name: "Intel Core i7-6700",
    cpu: "i7-6700",
    cpuCores: 4,
    ram: "64 GB",
    storage: "500 GB SSD / NVMe",
    ...STD_NET,
    price: 90,
  },
  {
    id: "ded-i7-8700-64",
    name: "Intel Core i7-8700",
    cpu: "i7-8700",
    cpuCores: 6,
    ram: "64 GB",
    storage: "SSD / NVMe",
    ...STD_NET,
    price: 110,
  },
  {
    id: "ded-xeon-e3-64",
    name: "Intel Xeon E3-1240v2",
    cpu: "Xeon E3-1240v2",
    cpuCores: 4,
    ram: "64 GB",
    storage: "500 GB SSD / NVMe",
    ...STD_NET,
    price: 120,
  },
  {
    id: "ded-ryzen7-64",
    name: "AMD Ryzen 7 3700X",
    cpu: "Ryzen 7 3700X",
    cpuCores: 8,
    ram: "64 GB",
    storage: "2 TB SSD / NVMe",
    ...STD_NET,
    price: 140,
  },
  {
    id: "ded-ryzen9-64",
    name: "AMD Ryzen 9 3900",
    cpu: "Ryzen 9 3900",
    cpuCores: 12,
    ram: "64 GB",
    storage: "2 TB SSD / NVMe",
    ...STD_NET,
    price: 150,
  },
  {
    id: "ded-ryzen9-128",
    name: "AMD Ryzen 9 5950X",
    cpu: "Ryzen 9 5950X",
    cpuCores: 16,
    ram: "128 GB",
    storage: "2 TB SSD / NVMe",
    ...STD_NET,
    price: 190,
  },
];
