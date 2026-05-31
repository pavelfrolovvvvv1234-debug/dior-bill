"use client";

import { useTransition } from "react";
import { exportBillingCsvAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function BillingExportButton() {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const csv = await exportBillingCsvAction();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      disabled={pending}
      onClick={handleExport}
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
