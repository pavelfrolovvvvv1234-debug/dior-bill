import { requireSession } from "@/lib/auth";
import { getSettingsLocale } from "@dior/backend";
import { PageContainer } from "@/components/layout/page-container";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const locale = await getSettingsLocale(session.user.id);

  return (
    <PageContainer>
      <SettingsShell initialLocale={locale}>{children}</SettingsShell>
    </PageContainer>
  );
}
