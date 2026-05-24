export type PlanTab =
  | "bulletproof-domains"
  | "bulletproof-vps"
  | "bulletproof-dedicated"
  | "vps"
  | "dedicated"
  | "turbovds"
  | "cdn";

export type PlanProductLine = {
  id: PlanTab;
  label: string;
  shortLabel: string;
  description: string;
  bulletproof?: boolean;
  /** Temporarily hidden from plan picker (e.g. CDN) */
  hidden?: boolean;
};

export const PLAN_PRODUCT_LINES: PlanProductLine[] = [
  {
    id: "bulletproof-vps",
    label: "Bulletproof VPS/VDS",
    shortLabel: "BP VPS",
    description: "DMCA-ignored offshore hosting",
    bulletproof: true,
  },
  {
    id: "bulletproof-dedicated",
    label: "Bulletproof dedicated servers",
    shortLabel: "BP Dedicated",
    description: "Bare metal with bulletproof policy",
    bulletproof: true,
  },
  {
    id: "bulletproof-domains",
    label: "Bulletproof domains",
    shortLabel: "BP Domains",
    description: "Abuse-resistant registration & DNS",
    bulletproof: true,
  },
  {
    id: "vps",
    label: "VPS/VDS",
    shortLabel: "VPS",
    description: "Standard virtual servers with instant provisioning",
  },
  {
    id: "dedicated",
    label: "Dedicated servers",
    shortLabel: "Dedicated",
    description: "Standard bare-metal infrastructure",
  },
  {
    id: "turbovds",
    label: "Turbovds",
    shortLabel: "Turbovds",
    description: "High-frequency compute for latency-sensitive workloads",
  },
  {
    id: "cdn",
    label: "CDN",
    shortLabel: "CDN",
    description: "Global edge delivery & caching",
    hidden: true,
  },
];

/** Visible product cards in the plan picker (order = grid layout). */
export const PLAN_PRODUCT_LINES_VISIBLE = PLAN_PRODUCT_LINES.filter((p) => !p.hidden);

const LEGACY_TAB_MAP: Record<string, PlanTab> = {
  "bulletproof-vps": "bulletproof-vps",
  vps: "vps",
  domains: "bulletproof-domains",
  dedicated: "dedicated",
  turbovds: "turbovds",
  cdn: "bulletproof-vps",
};

const VALID_TABS = new Set(PLAN_PRODUCT_LINES_VISIBLE.map((p) => p.id));

export function parsePlanTab(value: string | null | undefined): PlanTab {
  if (!value) return "bulletproof-vps";
  if (LEGACY_TAB_MAP[value]) return LEGACY_TAB_MAP[value];
  if (VALID_TABS.has(value as PlanTab)) return value as PlanTab;
  return "bulletproof-vps";
}

export function getPlanProductLine(id: PlanTab): PlanProductLine {
  return PLAN_PRODUCT_LINES.find((p) => p.id === id) ?? PLAN_PRODUCT_LINES[0];
}
