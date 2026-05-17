import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { hasPermission } from "@dior/shared";
import { requireControlSession } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireControlSession();
  const role = user.role as import("@dior/shared").UserRole;

  const modules = [
    "users.read",
    "services.write",
    "billing.write",
    "payments.write",
    "infrastructure.write",
    "security.write",
    "notifications.write",
    "audit.read",
  ] as const;

  return (
    <>
      <PageHeader title="Settings" description="RBAC, environment, control plane configuration" />
      <PageContainer>
        <Panel title="Your permissions">
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            {modules.map((p) => (
              <li key={p} className="flex items-center justify-between rounded border border-white/6 px-3 py-2">
                <span className="font-mono text-xs">{p}</span>
                <span className={hasPermission(role, p) ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}>
                  {hasPermission(role, p) ? "allowed" : "denied"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Environment">
          <dl className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <div className="flex justify-between"><dt>Admin URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001"}</dd></div>
            <div className="flex justify-between"><dt>Portal URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}</dd></div>
            <div className="flex justify-between"><dt>API URL</dt><dd className="font-mono text-foreground">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"}</dd></div>
          </dl>
        </Panel>
      </PageContainer>
    </>
  );
}
