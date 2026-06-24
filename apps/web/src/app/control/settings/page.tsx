import { getSettingsProfile } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { LocalizationSettings } from "@/components/settings/localization-settings";
import { SettingsLogout } from "@/components/settings/settings-logout";
import { requireControlSession } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireControlSession();
  const profile = await getSettingsProfile(user.id);

  return (
    <>
      <PageHeader title="Settings" description="RBAC, environment, control plane configuration" />
      <PageContainer>
        <Panel title="Environment">
          <dl className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <div className="flex justify-between"><dt>Admin URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001"}</dd></div>
            <div className="flex justify-between"><dt>Portal URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}</dd></div>
            <div className="flex justify-between"><dt>API URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"}</dd></div>
          </dl>
        </Panel>
        <LocalizationSettings initialLocale={profile.locale} />
        <Panel title="Account">
          <SettingsLogout />
        </Panel>
      </PageContainer>
    </>
  );
}
