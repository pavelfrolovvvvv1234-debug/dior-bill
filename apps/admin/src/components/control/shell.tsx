import { ControlSidebar } from "./sidebar";
import { ControlTopbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import type { ControlUser } from "@/lib/auth";

export function ControlShell({
  user,
  children,
}: {
  user: ControlUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen shell-bg">
      <CommandPalette />
      <ControlSidebar userRole={user.role} />
      <div className="pointer-events-none flex min-h-screen min-w-0 flex-col lg:ml-60">
        <div className="pointer-events-auto">
          <ControlTopbar user={user} />
        </div>
        <main className="pointer-events-auto flex-1">{children}</main>
      </div>
    </div>
  );
}
