import { requireSession } from "@/lib/auth";
import { getUserServices } from "@dior/backend";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { MyServicesView } from "@/components/services/my-services-view";
import { toServiceRow, sortServices } from "@/lib/service-catalog";
import { SelectPlanHeaderAction } from "@/components/plans/select-plan-header-action";

export default async function MyServicesPage() {
  const session = await requireSession();
  const services = await getUserServices(session.user.id);
  const rows = sortServices(services.map(toServiceRow));

  return (
    <>
      <I18nPageHeader
        titleKey="pages.services.title"
        descriptionKey="pages.services.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.overview", href: "/dashboard" },
          { labelKey: "nav.myServices" },
        ]}
        actions={<SelectPlanHeaderAction />}
      />
      <PageContainer>
        <MyServicesView rows={rows} />
      </PageContainer>
    </>
  );
}
