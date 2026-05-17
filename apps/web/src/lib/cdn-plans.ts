export type CdnPlan = {
  id: string;
  name: string;
  icon: string;
  priceFrom: number;
};

export const CDN_PLANS: readonly CdnPlan[] = [
  { id: "cdn-standard", name: "Standard", icon: "🚀", priceFrom: 25 },
  { id: "cdn-protected", name: "Protected", icon: "🛡️", priceFrom: 49 },
  { id: "cdn-vds", name: "CDN + VDS", icon: "⚡", priceFrom: 169 },
];
