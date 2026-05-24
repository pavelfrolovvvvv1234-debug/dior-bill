/** Read env with legacy PAYMENT_* aliases from .env.example */
function env(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export const paymentConfig = {
  crystalpay: {
    get authLogin() {
      return env("CRYSTALPAY_AUTH_LOGIN", "PAYMENT_CRYSTALPAY_ID");
    },
    get authSecret() {
      return env("CRYSTALPAY_AUTH_SECRET", "PAYMENT_CRYSTALPAY_SECRET_ONE");
    },
    get callbackSecret() {
      return env("CRYSTALPAY_CALLBACK_SECRET", "PAYMENT_CRYSTALPAY_SECRET_TWO");
    },
    get apiUrl() {
      return env("CRYSTALPAY_API_URL") ?? "https://api.crystalpay.io/v2";
    },
    get configured() {
      return Boolean(this.authLogin && this.authSecret);
    },
  },
  heleket: {
    get apiKey() {
      return env("HELEKET_API_KEY", "PAYMENT_HELEKET_API_KEY");
    },
    get merchantId() {
      return env("HELEKET_MERCHANT_ID", "PAYMENT_HELEKET_MERCHANT");
    },
    get webhookSecret() {
      return env("HELEKET_WEBHOOK_SECRET", "PAYMENT_HELEKET_WEBHOOK_SECRET");
    },
    get apiUrl() {
      const raw = env("HELEKET_API_URL", "PAYMENT_HELEKET_API_URL") ?? "https://api.heleket.com/v1";
      return raw.endsWith("/v1") ? raw : `${raw.replace(/\/$/, "")}/v1`;
    },
    get configured() {
      return Boolean(this.apiKey && this.merchantId);
    },
  },
  cryptobot: {
    get token() {
      return env("CRYPTOBOT_API_TOKEN", "PAYMENT_CRYPTOBOT_TOKEN");
    },
    /** @CryptoBot — never use the Dior login/support bot username here */
    get botUsername() {
      return (
        env("CRYPTOBOT_BOT_USERNAME", "NEXT_PUBLIC_CRYPTOBOT_BOT_USERNAME") ?? "CryptoBot"
      ).replace(/^@/, "");
    },
    get configured() {
      return Boolean(this.token);
    },
  },
};

export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `${provider} is not configured on the server. Set payment API keys in the environment (see .env.example).`,
    );
    this.name = "PaymentProviderNotConfiguredError";
  }
}

export function assertProviderConfigured(
  provider: "HELEKET" | "CRYPTOBOT" | "CRYSTALPAY",
): void {
  const map = {
    HELEKET: paymentConfig.heleket.configured,
    CRYPTOBOT: paymentConfig.cryptobot.configured,
    CRYSTALPAY: paymentConfig.crystalpay.configured,
  };
  if (!map[provider]) {
    if (isProductionRuntime()) {
      throw new PaymentProviderNotConfiguredError(provider);
    }
  }
}
