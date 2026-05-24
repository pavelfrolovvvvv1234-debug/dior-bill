import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_NAME, APP_TAGLINE, BRAND_FAVICON_URL } from "@dior/shared";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Infrastructure Console`,
  description: APP_TAGLINE,
  icons: {
    icon: [{ url: BRAND_FAVICON_URL, type: "image/x-icon", sizes: "any" }],
    apple: [{ url: BRAND_FAVICON_URL, type: "image/x-icon", sizes: "180x180" }],
    shortcut: [{ url: BRAND_FAVICON_URL, type: "image/x-icon" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
