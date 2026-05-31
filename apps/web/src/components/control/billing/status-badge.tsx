import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  PAID: "success",
  ACTIVE: "success",
  COMPLETED: "success",
  APPROVED: "success",
  RESOLVED: "success",
  PENDING: "warning",
  PROCESSING: "warning",
  MANUAL_REVIEW: "warning",
  OVERDUE: "destructive",
  FAILED: "destructive",
  REJECTED: "destructive",
  CANCELLED: "muted",
  CLOSED: "muted",
  EXPIRED: "muted",
  VOID: "muted",
};

export function BillingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "outline"} className="font-mono">
      {status}
    </Badge>
  );
}
