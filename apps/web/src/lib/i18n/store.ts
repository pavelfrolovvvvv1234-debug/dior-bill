"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isLocaleId, translate, type LocaleId } from "./index";

type I18nState = {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  t: (key: string) => string;
};

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
      t: (key) => translate(get().locale, key),
    }),
    { name: "dior-locale" },
  ),
);

export function syncLocaleFromProfile(locale: string | undefined) {
  if (locale && isLocaleId(locale)) {
    useI18n.getState().setLocale(locale);
  }
}

/** Translate outside React (toasts, actions, etc.) */
export function getT() {
  return useI18n.getState().t;
}
