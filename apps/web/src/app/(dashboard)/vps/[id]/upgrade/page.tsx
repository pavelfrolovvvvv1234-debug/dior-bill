import { notFound, redirect } from "next/navigation";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { requireSession } from "@/lib/auth";
import { getVpsById } from "@dior/backend";
import { VpsUpgradeView } from "@/components/vps/vps-upgrade-view";

export default async function VpsUpgradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  let vps;
  try {
    vps = await getVpsById(id, session.user.id);
  } catch {
    notFound();
  }

  if (vps.service.status !== "ACTIVE") {
    redirect(`/vps/${id}`);
  }

  return (
    <>
      <I18nPageHeader
        titleKey="services.upgradeTitle"
        descriptionKey="services.upgradePageDesc"
        breadcrumbs={[
          { labelKey: "nav.myServices", href: "/services" },
          { label: vps.hostname, href: `/vps/${id}` },
          { labelKey: "services.upgrade" },
        ]}
      />
      <PageContainer>
        <VpsUpgradeView
          vpsId={vps.id}
          hostname={vps.hostname}
          current={{
            cpuCores: vps.cpuCores,
            ramMb: vps.ramMb,
            diskGb: vps.diskGb,
            monthlyPrice: Number(vps.service.monthlyPrice),
          }}
        />
      </PageContainer>
    </>
  );
}
