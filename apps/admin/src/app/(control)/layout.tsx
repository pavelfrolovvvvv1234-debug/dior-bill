import { Suspense } from "react";
import { ControlShell } from "@/components/control/shell";
import { requireControlSession } from "@/lib/auth";
import ControlLoading from "./loading";

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const user = await requireControlSession();

  return (
    <ControlShell user={user}>
      <Suspense fallback={<ControlLoading />}>{children}</Suspense>
    </ControlShell>
  );
}
