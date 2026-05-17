import type { LucideIcon } from "lucide-react";
import { Globe, Key, Plug, Shield, User } from "lucide-react";

export type SettingsSection =
  | "account"
  | "security"
  | "integrations"
  | "localization"
  | "api";

export type SettingsNavItem = {
  id: SettingsSection;
  href: string;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: "account",
    href: "/settings/account",
    labelKey: "settings.nav.account",
    descriptionKey: "settings.nav.accountDesc",
    icon: User,
  },
  {
    id: "security",
    href: "/settings/security",
    labelKey: "settings.nav.security",
    descriptionKey: "settings.nav.securityDesc",
    icon: Shield,
  },
  {
    id: "integrations",
    href: "/settings/integrations",
    labelKey: "settings.nav.integrations",
    descriptionKey: "settings.nav.integrationsDesc",
    icon: Plug,
  },
  {
    id: "localization",
    href: "/settings/localization",
    labelKey: "settings.nav.localization",
    descriptionKey: "settings.nav.localizationDesc",
    icon: Globe,
  },
  {
    id: "api",
    href: "/settings/api",
    labelKey: "settings.nav.api",
    descriptionKey: "settings.nav.apiDesc",
    icon: Key,
  },
];

export function isSettingsSectionActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
