import { requireSession } from "@/lib/auth";
import { getLoginHistory, getSettingsProfile } from "@dior/backend";
import { AccountSettings } from "@/components/settings/account-settings";

export default async function SettingsAccountPage() {
  const session = await requireSession();
  const [profile, history] = await Promise.all([
    getSettingsProfile(session.user.id),
    getLoginHistory(session.user.id),
  ]);

  return <AccountSettings profile={profile} loginHistory={history} />;
}
