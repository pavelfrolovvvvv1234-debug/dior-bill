import { requireSession } from "@/lib/auth";
import { ApiSettings } from "@/components/settings/api-settings";

export default async function SettingsApiPage() {
  await requireSession();
  return <ApiSettings />;
}
