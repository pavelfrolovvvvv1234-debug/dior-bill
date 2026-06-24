"use client";

import { deleteUserAction } from "@/app/actions/control";
import { AdminDeleteButton } from "@/components/control/admin-delete-button";

export function UserRowDelete({ userId, email }: { userId: string; email?: string | null }) {
  return (
    <AdminDeleteButton
      label=""
      variant="ghost"
      confirmMessage={`Delete ${email ?? "this user"} permanently? All related data will be removed.`}
      onDelete={() => deleteUserAction(userId)}
    />
  );
}
