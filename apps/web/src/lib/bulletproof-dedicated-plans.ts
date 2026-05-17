import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";

export type BulletproofDedicatedPlan = DedicatedCatalogPlan;

const BP_NET = { network: "1 Gbps", bandwidth: "Unlimited" } as const;

/** Bulletproof bare-metal — site prices unchanged; specs from product catalog */
export const BULLETPROOF_DEDICATED_PLANS: readonly DedicatedCatalogPlan[] = [
  {
    id: "bp-ded-e3-16",
    name: "Intel Xeon E3-1240v2",
    cpu: "Xeon E3-1240v2",
    cpuCores: 4,
    ram: "16 GB",
    storage: "SSD / NVMe",
    ...BP_NET,
    price: 162,
  },
  {
    id: "bp-ded-e3-32",
    name: "Intel Xeon E3-1240v2",
    cpu: "Xeon E3-1240v2",
    cpuCores: 4,
    ram: "32 GB",
    storage: "250 GB",
    ...BP_NET,
    price: 189,
  },
  {
    id: "bp-ded-2x-144",
    name: "2x Intel Xeon E5-2650 v2",
    cpu: "2x Xeon E5-2650 v2",
    cpuCores: 16,
    ram: "192 GB",
    storage: "480 GB SATA SSD",
    ...BP_NET,
    price: 315,
  },
  {
    id: "bp-ded-2x-64",
    name: "2x Intel Xeon E5-2680 v4",
    cpu: "2x Xeon E5-2680 v4",
    cpuCores: 28,
    ram: "128 GB",
    storage: "480 GB SATA SSD",
    ...BP_NET,
    price: 224.1,
  },
  {
    id: "bp-ded-2x-256",
    name: "2x Intel Xeon E5-2690 v4",
    cpu: "2x Xeon E5-2690 v4",
    cpuCores: 28,
    ram: "256 GB",
    storage: "800 GB NVMe",
    ...BP_NET,
    price: 449.1,
  },
  {
    id: "bp-ded-2x-512",
    name: "2x Intel Xeon Platinum 8168",
    cpu: "2x Platinum 8168",
    cpuCores: 48,
    ram: "512 GB",
    storage: "2 TB NVMe",
    ...BP_NET,
    price: 702,
  },
  {
    id: "bp-ded-plat-8173",
    name: "2x Intel Xeon Platinum 8168",
    cpu: "2x Platinum 8168",
    cpuCores: 48,
    ram: "768 GB",
    storage: "2 TB NVMe",
    ...BP_NET,
    price: 990,
  },
  {
    id: "bp-ded-plat-8168-1tb",
    name: "2x Intel Xeon Platinum 8168",
    cpu: "2x Platinum 8168",
    cpuCores: 48,
    ram: "1024 GB",
    storage: "2 TB NVMe",
    ...BP_NET,
    price: 2160,
  },
];
