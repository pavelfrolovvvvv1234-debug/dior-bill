"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function SettingsLogout() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logoutAction();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-4">
      <p className="text-sm font-medium">Sign out</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        End your control panel session. You will need to sign in again to access the admin area.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
        disabled={loading}
        onClick={handleLogout}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        )}
        Sign out
      </Button>
    </div>
  );
}
