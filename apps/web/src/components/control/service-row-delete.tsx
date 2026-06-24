"use client";

import { deleteServiceAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function ServiceRowDelete({ serviceId, label }: { serviceId: string; label: string }) {
  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      confirmMessage={`Delete service "${label}" permanently?`}
      onDelete={() => deleteServiceAction(serviceId)}
    />
  );
}
