import { Badge } from "@/components/ui/badge";

const map: Record<string, { variant: "success" | "warning" | "destructive" | "muted" | "default"; label: string }> = {
  PAID: { variant: "success", label: "Paid" },
  PENDING: { variant: "warning", label: "Pending" },
  OVERDUE: { variant: "destructive", label: "Overdue" },
  CANCELLED: { variant: "muted", label: "Cancelled" },
  DRAFT: { variant: "muted", label: "Draft" },
  FAILED: { variant: "destructive", label: "Failed" },
  REFUNDED: { variant: "default", label: "Refunded" },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = map[status.toUpperCase()] ?? { variant: "muted" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
