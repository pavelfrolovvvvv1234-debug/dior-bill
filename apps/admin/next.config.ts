import type { NextConfig } from "next";
import { BRAND_FAVICON_URL } from "@dior/shared";

const brandFaviconRedirects = [
  "/favicon.ico",
  "/favicon-16.png",
  "/favicon-32.png",
  "/favicon-48.png",
  "/apple-touch-icon.png",
  "/icon-16.png",
  "/icon-32.png",
  "/icon-48.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
].map((source) => ({
  source,
  destination: BRAND_FAVICON_URL,
  permanent: true,
}));

const nextConfig: NextConfig = {
  transpilePackages: ["@dior/backend", "@dior/database", "@dior/shared"],
  async redirects() {
    return brandFaviconRedirects;
  },
};

export default nextConfig;
