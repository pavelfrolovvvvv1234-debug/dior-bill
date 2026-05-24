"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isLocaleId, translate, type LocaleId } from "./index";
import { setLocaleCookie } from "./cookie";

type I18nState = {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: "en",
      setLocale: (locale) => {
        setLocaleCookie(locale);
        set({ locale });
      },
      t: (key, vars) => translate(get().locale, key, vars),
    }),
    {
      name: "dior-locale",
      onRehydrateStorage: () => (state) => {
        if (state?.locale) setLocaleCookie(state.locale);
      },
    },
  ),
);

export function syncLocaleFromProfile(locale: string | undefined) {
  if (locale && isLocaleId(locale)) {
    const { setLocale } = useI18n.getState();
    setLocale(locale);
  }
}

/** Translate outside React (toasts, actions, etc.) */
export function getT() {
  return useI18n.getState().t;
}
