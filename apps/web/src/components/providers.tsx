"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { DiorPreloader } from "@/components/auth/dior-preloader";
import { LocaleHtmlLang } from "@/components/i18n/locale-html-lang";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
        <LocaleHtmlLang />
        <DiorPreloader />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
