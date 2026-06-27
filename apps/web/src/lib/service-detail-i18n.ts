const DETAIL_I18N_KEYS: Record<string, string> = {
  Provisioning: "services.detail.provisioning",
  "Pending IP": "services.detail.pendingIp",
};

/** Translate known service detail placeholders (IP, provisioning state). */
export function translateServiceDetail(
  detail: string,
  t: (key: string) => string,
): string {
  const key = DETAIL_I18N_KEYS[detail];
  if (!key) return detail;
  const label = t(key);
  return label !== key ? label : detail;
}
