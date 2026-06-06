import { PageHeader as EnterprisePageHeader } from "@/components/ui/enterprise/page-header";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <EnterprisePageHeader
      title={title}
      description={description}
      actions={actions}
    />
  );
}
