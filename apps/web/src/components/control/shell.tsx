import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "./command-palette";
import type { ControlUser } from "@/lib/control-auth";

export function ControlShell({
  user,
  children,
}: {
  user: ControlUser;
  children: React.ReactNode;
}) {
  return (
    <AppShell user={{ email: user.email, role: user.role, locale: user.locale }}>
      <CommandPalette />
      {children}
    </AppShell>
  );
}
