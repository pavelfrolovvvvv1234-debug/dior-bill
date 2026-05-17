import { ControlSidebar } from "./sidebar";
import { ControlTopbar } from "./topbar";
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
    <div className="flex min-h-screen bg-[#09090b]">
      <CommandPalette />
      <ControlSidebar userRole={user.role} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <ControlTopbar user={user} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
