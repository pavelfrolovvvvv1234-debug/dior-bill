import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { SettingsLogout } from "@/components/control/settings-logout";
import { requireControlSession } from "@/lib/auth";

export default async function SettingsPage() {
  await requireControlSession();

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
        <Panel title="Account">
          <SettingsLogout />
        </Panel>
      </PageContainer>
    </>
  );
}
