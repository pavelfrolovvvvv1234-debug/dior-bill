import { requireSession } from "@/lib/auth";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { NewTicketForm } from "@/components/support/new-ticket-form";

export default async function NewSupportTicketPage() {
  await requireSession();

  return (
    <>
      <I18nPageHeader
        titleKey="pages.supportNew.title"
        descriptionKey="pages.supportNew.description"
        breadcrumbs={[
          { labelKey: "nav.support", href: "/support" },
          { labelKey: "support.newTicket" },
        ]}
      />
      <PageContainer className="max-w-2xl">
        <NewTicketForm />
      </PageContainer>
    </>
  );
}
