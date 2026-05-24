/** Shared network profile for bulletproof offshore VPS line */
const BP_NETWORK = { networkMbps: 150, bandwidthLabel: "Unlimited" as const, bandwidthTb: 999 };

export type VpsPlanDisplay = "standard" | "bulletproof" | "turbovds";

export type VpsPlan = {
  id: string;
  name: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  networkMbps: number;
  bandwidthLabel: string;
  bandwidthTb: number;
  price: number;
  popular?: boolean;
  display?: VpsPlanDisplay;
  /** Override labels for Turbovds / premium cards */
  ramDisplay?: string;
  diskDisplay?: string;
  networkDisplay?: string;
  portDisplay?: string;
  ppsDisplay?: string;
};

const STD_NETWORK = { networkMbps: 1000, bandwidthLabel: "Fair use" as const, bandwidthTb: 10 };

export const STANDARD_VPS_PLANS: readonly VpsPlan[] = [
  {
    id: "std-1",
    name: "VPS S",
    cpuCores: 1,
    ramMb: 2048,
    diskGb: 40,
    ...STD_NETWORK,
    price: 12,
    display: "standard",
  },
  {
    id: "std-2",
    name: "VPS M",
    cpuCores: 2,
    ramMb: 4096,
    diskGb: 80,
    ...STD_NETWORK,
    price: 24,
    popular: true,
    display: "standard",
  },
  {
    id: "std-3",
    name: "VPS L",
    cpuCores: 4,
    ramMb: 8192,
    diskGb: 160,
    ...STD_NETWORK,
    price: 48,
    display: "standard",
  },
  {
    id: "std-4",
    name: "VDS XL",
    cpuCores: 8,
    ramMb: 16384,
    diskGb: 320,
    ...STD_NETWORK,
    price: 96,
    display: "standard",
  },
];

export const VPS_PLANS: readonly VpsPlan[] = [
  { id: "lite1", name: "Lite 1", cpuCores: 1, ramMb: 1024, diskGb: 10, ...BP_NETWORK, price: 25 },
  { id: "lite2", name: "Lite 2", cpuCores: 2, ramMb: 2048, diskGb: 40, ...BP_NETWORK, price: 27, popular: true },
  { id: "lite3", name: "Lite 3", cpuCores: 2, ramMb: 4096, diskGb: 50, ...BP_NETWORK, price: 39 },
  { id: "elite1", name: "Elite 1", cpuCores: 4, ramMb: 8192, diskGb: 80, ...BP_NETWORK, price: 65 },
  { id: "elite2", name: "Elite 2", cpuCores: 8, ramMb: 16384, diskGb: 150, ...BP_NETWORK, price: 99 },
  { id: "elite3", name: "Elite 3", cpuCores: 8, ramMb: 24576, diskGb: 200, ...BP_NETWORK, price: 115 },
  { id: "mega1", name: "Mega 1", cpuCores: 12, ramMb: 32768, diskGb: 250, ...BP_NETWORK, price: 159 },
  { id: "mega2", name: "Mega 2", cpuCores: 16, ramMb: 65536, diskGb: 300, ...BP_NETWORK, price: 199 },
  { id: "mega3", name: "Mega 3", cpuCores: 24, ramMb: 98304, diskGb: 500, ...BP_NETWORK, price: 285 },
  { id: "mega4", name: "Mega 4", cpuCores: 24, ramMb: 131072, diskGb: 700, ...BP_NETWORK, price: 340 },
];

const TURBO_NET_SHARED = {
  networkMbps: 10_000,
  networkDisplay: "10 Gbps",
  portDisplay: "20 Gbit",
  ppsDisplay: "~450-800",
  bandwidthLabel: "Unlimited",
  bandwidthTb: 999,
  display: "turbovds" as const,
};

export const TURBO_VPS_PLANS: readonly VpsPlan[] = [
  {
    id: "turbonet-l",
    name: "TurboNet L",
    cpuCores: 4,
    ramMb: 8192,
    diskGb: 50,
    ramDisplay: "8 GB (DDR5)",
    diskDisplay: "50 GB NVMe",
    price: 150,
    ...TURBO_NET_SHARED,
  },
  {
    id: "turbonet-m",
    name: "TurboNet M",
    cpuCores: 8,
    ramMb: 16384,
    diskGb: 100,
    ramDisplay: "16 GB (DDR5)",
    diskDisplay: "100 GB NVMe",
    price: 199,
    popular: true,
    ...TURBO_NET_SHARED,
  },
  {
    id: "turbonet-s",
    name: "TurboNet S",
    cpuCores: 16,
    ramMb: 32768,
    diskGb: 150,
    ramDisplay: "32 GB (DDR5)",
    diskDisplay: "150 GB NVMe",
    price: 259,
    ...TURBO_NET_SHARED,
  },
];
