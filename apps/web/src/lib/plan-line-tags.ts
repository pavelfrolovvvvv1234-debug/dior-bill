import type { PlanTab } from "./plan-catalog";

/** Product-line tags shown on dashboard catalog and /plans nav cards. */
export const PLAN_LINE_TAG_KEYS: Partial<Record<PlanTab, string[]>> = {
  "bulletproof-vps": ["dashboard.tags.offshore", "dashboard.tags.instantDeploy"],
  "bulletproof-dedicated": ["dashboard.tags.offshore", "dashboard.tags.setup4to12h"],
  "bulletproof-domains": ["dashboard.tags.offshore", "dashboard.tags.registration4to8h"],
  vps: ["dashboard.tags.regular", "dashboard.tags.instantDeploy"],
  dedicated: ["dashboard.tags.regular", "dashboard.tags.setup4to12h"],
  turbovds: [
    "dashboard.tags.offshore",
    "dashboard.tags.highInternet",
    "dashboard.tags.hiCpu",
    "dashboard.tags.setup2to3h",
  ],
};
