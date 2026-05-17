"use client";

import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";

interface ServiceQuickActionsProps {
  manageHref: string;
}

export function ServiceQuickActions({ manageHref }: ServiceQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="default" size="sm" className="h-8" asChild>
        <FastLink href={manageHref}>Manage</FastLink>
      </Button>
      <Button variant="outline" size="sm" className="hidden h-8 lg:inline-flex" asChild>
        <FastLink href="/billing">Renew</FastLink>
      </Button>
      <Button variant="ghost" size="sm" className="hidden h-8 xl:inline-flex" asChild>
        <FastLink href="/plans">Upgrade</FastLink>
      </Button>
    </div>
  );
}
