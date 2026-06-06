import { PageContainer as LayoutPageContainer } from "@/components/layout/page-container";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <LayoutPageContainer className={className}>{children}</LayoutPageContainer>
  );
}
