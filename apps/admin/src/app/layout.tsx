import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, BRAND_FAVICON_URL } from "@dior/shared";

export const metadata: Metadata = {
  title: `${APP_NAME} Admin`,
  icons: {
    icon: [{ url: BRAND_FAVICON_URL, type: "image/x-icon", sizes: "any" }],
    apple: [{ url: BRAND_FAVICON_URL, type: "image/x-icon", sizes: "180x180" }],
    shortcut: [{ url: BRAND_FAVICON_URL, type: "image/x-icon" }],
  },
  manifest: "/site.webmanifest",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="dark min-h-screen antialiased">{children}</body>
    </html>
  );
}
