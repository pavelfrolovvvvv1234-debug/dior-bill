import { requireSession } from "@/lib/auth";
import { getSettingsProfile } from "@dior/backend";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";

export default async function SettingsIntegrationsPage() {
  const session = await requireSession();
  const profile = await getSettingsProfile(session.user.id);
  return <IntegrationsSettings profile={profile} />;
}
