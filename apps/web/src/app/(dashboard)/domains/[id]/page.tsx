import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { requireSession } from "@/lib/auth";
import {
  getDomainById,
  getDomainNameservers,
  isAmperDnsConfigured,
  parseNameserversFromDb,
} from "@dior/backend";
import { DomainDetailTabs } from "@/components/domains/domain-detail-tabs";

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  let domain;
  try {
    domain = await getDomainById(id, session.user.id);
  } catch {
    notFound();
  }

  const ns = await getDomainNameservers(id, session.user.id);
  const storedNs = parseNameserversFromDb(domain.nameservers);

  return (
    <>
      <PageHeader
        title={domain.domainName}
        description="Domain registration, DNS & SSL"
        breadcrumbs={[
          { label: "My Services", href: "/services" },
          { label: domain.domainName },
        ]}
      />
      <PageContainer>
        <DomainDetailTabs
          domainId={domain.id}
          domainName={domain.domainName}
          registrar={domain.registrar}
          status={domain.status}
          serviceStatus={domain.service.status}
          expiresAt={domain.expiresAt}
          autoRenew={domain.service.autoRenew}
          initialNs={ns.nameservers.length > 0 ? ns.nameservers : storedNs}
          amperConfigured={ns.amperConfigured}
          dnsManaged={domain.dnsManaged}
          amperDnsConfigured={isAmperDnsConfigured()}
        />
      </PageContainer>
    </>
  );
}
