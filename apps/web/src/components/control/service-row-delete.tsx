"use client";

import { deleteServiceAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function ServiceRowDelete({ serviceId, label }: { serviceId: string; label: string }) {
  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      title="Delete service?"
      description="VPS, domain, or CDN records for this service will be permanently removed."
      entityName={label}
      onDelete={() => deleteServiceAction(serviceId)}
    />
  );
}
