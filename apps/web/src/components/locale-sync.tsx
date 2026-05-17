"use client";

import { useEffect } from "react";
import { isLocaleId } from "@/lib/i18n";
import { syncLocaleFromProfile } from "@/lib/i18n/store";

export function LocaleSync({ locale }: { locale?: string | null }) {
  useEffect(() => {
    if (locale && isLocaleId(locale)) {
      syncLocaleFromProfile(locale);
    }
  }, [locale]);

  return null;
}
