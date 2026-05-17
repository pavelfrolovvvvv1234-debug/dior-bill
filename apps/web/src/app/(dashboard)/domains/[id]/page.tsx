import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { requireSession } from "@/lib/auth";
import { getDomainById, getDomainNameservers, parseNameserversFromDb } from "@dior/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CustomerDomainNameservers } from "@/components/domains/customer-domain-nameservers";
import { Globe } from "lucide-react";

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
        description="Domain registration & DNS nameservers"
        breadcrumbs={[
          { label: "My Services", href: "/services" },
          { label: domain.domainName },
        ]}
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="glass">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Nameservers
                </CardTitle>
                <Badge variant={domain.service.status === "ACTIVE" ? "success" : "warning"}>
                  {domain.service.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <CustomerDomainNameservers
                  domainId={domain.id}
                  initial={ns.nameservers.length > 0 ? ns.nameservers : storedNs}
                  amperConfigured={ns.amperConfigured}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Domain info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Registrar", domain.registrar],
                ["Status", domain.status],
                ["Expires", domain.expiresAt ? formatDate(domain.expiresAt) : "—"],
                [
                  "Auto renew",
                  domain.service.autoRenew ? "Enabled" : "Disabled",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
