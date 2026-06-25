import { Badge } from "@/components/ui/badge";
import { ticketStatusLabel } from "@/lib/ticket-labels";

const VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "default"> = {
  OPEN: "default",
  AWAITING_STAFF: "warning",
  AWAITING_CUSTOMER: "default",
  RESOLVED: "success",
  CLOSED: "muted",
};

export function TicketStatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const variant = VARIANT[key] ?? "muted";

  return <Badge variant={variant}>{ticketStatusLabel(status)}</Badge>;
}
