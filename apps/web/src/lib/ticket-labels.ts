/** Ticket status/priority labels are always English (ops-facing enums). */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  AWAITING_STAFF: "Awaiting support",
  AWAITING_CUSTOMER: "Awaiting customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export function ticketStatusLabel(status: string): string {
  const key = status.toUpperCase();
  return TICKET_STATUS_LABELS[key] ?? status;
}

export function ticketPriorityLabel(priority: string): string {
  const key = priority.toUpperCase();
  return TICKET_PRIORITY_LABELS[key] ?? priority;
}
