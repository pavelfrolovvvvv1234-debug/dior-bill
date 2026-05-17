import { requireSession } from "@/lib/auth";
import { getSettingsProfile } from "@dior/backend";
import { LocalizationSettings } from "@/components/settings/localization-settings";

export default async function SettingsLocalizationPage() {
  const session = await requireSession();
  const profile = await getSettingsProfile(session.user.id);
  return <LocalizationSettings initialLocale={profile.locale} />;
}
