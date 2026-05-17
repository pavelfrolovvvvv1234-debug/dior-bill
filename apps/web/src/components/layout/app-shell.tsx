import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { NavigationProgress } from "./navigation-progress";
import { ToastHost } from "@/components/ui/toast-host";
import { LocaleSync } from "@/components/locale-sync";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    email: string | null;
    role?: string;
    locale?: string;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="min-h-screen shell-bg">
      <LocaleSync locale={user.locale} />
      <ToastHost />
      <NavigationProgress />
      <div className="shell-content">
        <Sidebar userRole={user.role} />
        <div className="pointer-events-none flex min-h-screen min-w-0 flex-col lg:ml-64">
          <div className="pointer-events-auto">
            <Topbar user={user} />
          </div>
          <main className="pointer-events-auto flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
