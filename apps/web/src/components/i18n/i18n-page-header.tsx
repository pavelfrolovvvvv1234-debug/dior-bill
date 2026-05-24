"use client";

import { PageHeader, type BreadcrumbItem } from "@/components/ui/enterprise/page-header";
import { useI18n } from "@/lib/i18n/store";

type BreadcrumbKey = { labelKey: string; href?: string };

interface I18nPageHeaderProps {
  titleKey: string;
  descriptionKey?: string;
  breadcrumbs?: BreadcrumbKey[];
  actions?: React.ReactNode;
  className?: string;
  /** Raw title when dynamic (e.g. hostname) — skips titleKey */
  title?: string;
  /** Raw description when dynamic */
  description?: string;
}

export function I18nPageHeader({
  titleKey,
  descriptionKey,
  breadcrumbs,
  actions,
  className,
  title,
  description,
}: I18nPageHeaderProps) {
  const { t } = useI18n();

  const resolvedBreadcrumbs: BreadcrumbItem[] | undefined = breadcrumbs?.map((b) => ({
    label: t(b.labelKey),
    href: b.href,
  }));

  return (
    <PageHeader
      title={title ?? t(titleKey)}
      description={description ?? (descriptionKey ? t(descriptionKey) : undefined)}
      breadcrumbs={resolvedBreadcrumbs}
      actions={actions}
      className={className}
    />
  );
}
