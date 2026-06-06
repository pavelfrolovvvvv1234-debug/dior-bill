"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { controlPath } from "@/lib/control-paths";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[control/billing]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-foreground">Не удалось загрузить раздел биллинга</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Произошла ошибка при открытии страницы."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={() => reset()}>
          Повторить
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={controlPath("/billing")}>К биллингу</Link>
        </Button>
      </div>
    </div>
  );
}
