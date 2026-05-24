"use client";

import { TOPUP_PROVIDER_META, type TopUpProviderMeta, type TopUpProviderId } from "@dior/shared";
import { useI18n } from "./store";

export function useTopUpProviders(): TopUpProviderMeta[] {
  const { t } = useI18n();

  return TOPUP_PROVIDER_META.map((p) => ({
    ...p,
    name: t(`billing.providers.${p.id}.name`),
    description: t(`billing.providers.${p.id}.description`),
    speed: t(`billing.providers.${p.id}.speed`),
    methods: p.methods.map((m) => t(`billing.methods.${m}`) || m),
  }));
}

export function useTopUpProviderLabel(id: TopUpProviderId): string {
  const { t } = useI18n();
  return t(`billing.providers.${id}.name`);
}
