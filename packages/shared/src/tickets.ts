export const CUSTOMER_TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;

export type CustomerTicketPriority = (typeof CUSTOMER_TICKET_PRIORITIES)[number];

export const ALL_TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type TicketPriorityLevel = (typeof ALL_TICKET_PRIORITIES)[number];

/** Lower rank = higher urgency (for sorting). */
export const TICKET_PRIORITY_RANK: Record<TicketPriorityLevel, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function isCustomerTicketPriority(value: string): value is CustomerTicketPriority {
  return (CUSTOMER_TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function isTicketPriorityLevel(value: string): value is TicketPriorityLevel {
  return (ALL_TICKET_PRIORITIES as readonly string[]).includes(value);
}
