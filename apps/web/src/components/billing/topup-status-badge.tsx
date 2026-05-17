import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "muted" | "outline"
> = {
  PENDING: "muted",
  PROCESSING: "default",
  PAID: "success",
  FAILED: "destructive",
  EXPIRED: "outline",
  REFUNDED: "outline",
  MANUAL_REVIEW: "warning",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
  MANUAL_REVIEW: "Awaiting review",
};

export function TopUpStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusVariant[status] ?? "muted"} className={cn("font-medium", className)}>
      {statusLabel[status] ?? status}
    </Badge>
  );
}
