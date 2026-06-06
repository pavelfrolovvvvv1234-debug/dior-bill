import { Panel as EnterprisePanel } from "@/components/ui/enterprise/panel";

export function Panel({
  title,
  description,
  action,
  children,
  noPadding,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <EnterprisePanel
      title={title}
      description={description}
      action={action}
      noPadding={noPadding}
    >
      {children}
    </EnterprisePanel>
  );
}
