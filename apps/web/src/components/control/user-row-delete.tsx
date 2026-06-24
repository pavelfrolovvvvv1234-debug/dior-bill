"use client";

import { deleteUserAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function UserRowDelete({ userId, email }: { userId: string; email?: string | null }) {
  const entityName = email ?? userId.slice(0, 10);

  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      title="Delete user?"
      description="All services, tickets, invoices, and sessions linked to this account will be removed."
      entityName={entityName}
      onDelete={() => deleteUserAction(userId)}
    />
  );
}
