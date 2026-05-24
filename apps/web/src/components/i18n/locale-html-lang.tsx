"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/store";

export function LocaleHtmlLang() {
  const locale = useI18n((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
