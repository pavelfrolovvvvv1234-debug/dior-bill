import { requireSession } from "@/lib/auth";
import { getUserServices } from "@dior/backend";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { MyServicesView } from "@/components/services/my-services-view";
import { toServiceRow, sortServices } from "@/lib/service-catalog";
import { Button } from "@/components/ui/button";
import { FastLink } from "@/components/ui/fast-link";
import { Plus } from "lucide-react";

export default async function MyServicesPage() {
  const session = await requireSession();
  const services = await getUserServices(session.user.id);
  const rows = sortServices(services.map(toServiceRow));

  return (
    <>
      <PageHeader
        title="My Services"
        description="Active and historical infrastructure — manage, renew, and upgrade"
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "My Services" }]}
        actions={
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/plans">
              <Plus className="h-3.5 w-3.5" />
              Select plan
            </FastLink>
          </Button>
        }
      />
      <PageContainer>
        <MyServicesView rows={rows} />
      </PageContainer>
    </>
  );
}
