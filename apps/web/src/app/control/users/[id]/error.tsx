"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { controlPath } from "@/lib/control-paths";

export default function UserDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[control/users]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-foreground">Could not load user profile</p>
      <p className="max-w-md text-sm text-[var(--muted-foreground)]">
        {error.message || "Something went wrong while rendering this page."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={controlPath("/users")}>Back to users</Link>
        </Button>
      </div>
    </div>
  );
}
