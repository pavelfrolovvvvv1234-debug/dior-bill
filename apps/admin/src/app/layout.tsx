import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@dior/shared";

export const metadata: Metadata = {
  title: `${APP_NAME} Admin`,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="dark min-h-screen antialiased">{children}</body>
    </html>
  );
}
