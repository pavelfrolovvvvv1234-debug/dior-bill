import { requireSession } from "@/lib/auth";
import { getSettingsProfile } from "@dior/backend";
import { AccountSettings } from "@/components/settings/account-settings";

export default async function SettingsAccountPage() {
  const session = await requireSession();
  const profile = await getSettingsProfile(session.user.id);

  return <AccountSettings profile={profile} />;
}
