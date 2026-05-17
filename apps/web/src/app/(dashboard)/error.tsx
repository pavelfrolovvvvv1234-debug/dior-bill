"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/enterprise/panel";
import { FastLink } from "@/components/ui/fast-link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center p-6">
      <Panel title="Something went wrong" description="The page could not be loaded">
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Check that MySQL is running."}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">ID: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button type="button" variant="outline" asChild>
            <FastLink href="/dashboard">Dashboard</FastLink>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
