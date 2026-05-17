import { requireSession } from "@/lib/auth";
import { getSettingsProfile } from "@dior/backend";
import { SecuritySettings } from "@/components/settings/security-settings";

export default async function SettingsSecurityPage() {
  const session = await requireSession();
  const profile = await getSettingsProfile(session.user.id);
  return <SecuritySettings profile={profile} />;
}
