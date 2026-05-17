import { PageHeader, type BreadcrumbItem } from "@/components/ui/enterprise/page-header";

interface HeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  user?: { email: string | null };
}

/** @deprecated Use PageHeader directly — kept for legacy routes */
export function Header({ title, description, breadcrumbs, actions }: HeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
    />
  );
}
