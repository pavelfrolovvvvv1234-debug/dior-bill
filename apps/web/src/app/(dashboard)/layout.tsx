import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff";
import DashboardLoading from "./loading";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (isStaffRole(session.user.role)) {
    redirect("/control");
  }

  return (
    <AppShell user={session.user}>
      <Suspense fallback={<DashboardLoading />}>{children}</Suspense>
    </AppShell>
  );
}
