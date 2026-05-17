import type { TopUpProvider } from "@dior/database";
import type { PaymentProviderAdapter } from "./types";
import { heleketProvider } from "./heleket";
import { cryptobotProvider } from "./cryptobot";
import { crystalpayProvider } from "./crystalpay";
import { manualTransferProvider } from "./manual";

const registry: Record<TopUpProvider, PaymentProviderAdapter> = {
  HELEKET: heleketProvider,
  CRYPTOBOT: cryptobotProvider,
  CRYSTALPAY: crystalpayProvider,
  MANUAL_TRANSFER: manualTransferProvider,
};

export function getProviderAdapter(provider: TopUpProvider): PaymentProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter;
}

export * from "./types";
