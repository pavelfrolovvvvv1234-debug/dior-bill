export const TOPUP_PROVIDERS = {
  HELEKET: "HELEKET",
  CRYPTOBOT: "CRYPTOBOT",
  CRYSTALPAY: "CRYSTALPAY",
  MANUAL_TRANSFER: "MANUAL_TRANSFER",
} as const;

export type TopUpProviderId = (typeof TOPUP_PROVIDERS)[keyof typeof TOPUP_PROVIDERS];

export const TOPUP_STATUSES = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
  MANUAL_REVIEW: "MANUAL_REVIEW",
} as const;

export type TopUpStatusId = (typeof TOPUP_STATUSES)[keyof typeof TOPUP_STATUSES];

export const TOPUP_MIN_AMOUNT = 5;
export const TOPUP_MAX_AMOUNT = 50_000;
export const TOPUP_DEFAULT_EXPIRY_MINUTES = 60;
export const MANUAL_SUPPORT_TELEGRAM = "@diorhost";

export interface TopUpProviderMeta {
  id: TopUpProviderId;
  name: string;
  description: string;
  methods: string[];
  speed: string;
  feePercent: number;
  available: boolean;
}

export const TOPUP_PROVIDER_META: TopUpProviderMeta[] = [
  {
    id: "HELEKET",
    name: "Heleket",
    description: "Multi-asset crypto checkout with instant settlement",
    methods: ["BTC", "ETH", "USDT", "LTC", "TON"],
    speed: "~5 min",
    feePercent: 0,
    available: true,
  },
  {
    id: "CRYPTOBOT",
    name: "CryptoBot",
    description: "Native Telegram Crypto Pay — fast in-app invoices",
    methods: ["USDT", "TON", "BTC", "ETH", "TRX"],
    speed: "Instant",
    feePercent: 0,
    available: true,
  },
  {
    id: "CRYSTALPAY",
    name: "CrystalPay",
    description: "Flexible crypto & fiat rails for global top-ups",
    methods: ["USDT", "BTC", "ETH", "Bank"],
    speed: "~10 min",
    feePercent: 0,
    available: true,
  },
  {
    id: "MANUAL_TRANSFER",
    name: "Direct Transfer",
    description: "Wire/crypto via Telegram support with manual approval",
    methods: ["Bank", "Crypto", "Other"],
    speed: "1–24h",
    feePercent: 0,
    available: true,
  },
];
