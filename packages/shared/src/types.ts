export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionPayload {
  userId: string;
  sessionId: string;
  role: string;
}

export interface DashboardStats {
  balance: number;
  credits: number;
  activeServices: number;
  pendingInvoices: number;
  referralEarnings: number;
  unreadNotifications: number;
}

export interface VpsMetrics {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  bandwidthUsedGb: number;
  bandwidthLimitTb: number;
  uptimeSeconds: number;
}

export interface InfrastructureFeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  createdAt: string;
  pinned?: boolean;
}

export type QueueJobType =
  | "vps.provision"
  | "vps.reboot"
  | "vps.reinstall"
  | "vps.sync_metrics"
  | "vps.sync_ip"
  | "payment.retry"
  | "topup.expire"
  | "notification.send"
  | "invoice.overdue"
  | "service.renew"
  | "event.process"
  | "reconciliation.run"
  | "billing.unpaid_check"
  | "billing.scheduler";

export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  type: QueueJobType;
  payload: T;
  attempts: number;
  createdAt: string;
}
