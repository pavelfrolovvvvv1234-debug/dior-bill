export type SettingsProfile = {
  id: string;
  email: string | null;
  locale: string;
  timezone: string;
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
  telegram: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  telegramNotifications: {
    billing: boolean;
    abuse: boolean;
    serverStatus: boolean;
  };
  apiKeys: {
    id: string;
    label: string;
    keyPrefix: string;
    permissions: string[];
    rateLimitDay: number;
    requestsToday: number;
    lastUsedAt: Date | null;
    lastUsedIp: string | null;
    createdAt: Date;
    auditCount: number;
  }[];
};
