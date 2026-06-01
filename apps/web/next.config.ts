import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { BRAND_FAVICON_URL } from "@dior/shared";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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
  outputFileTracingRoot: path.join(rootDir, "../.."),
  transpilePackages: ["@dior/backend", "@dior/database", "@dior/shared"],
  async redirects() {
    return [
      ...brandFaviconRedirects,
      { source: "/vps", destination: "/services", permanent: false },
      { source: "/vps/new", destination: "/plans?tab=bulletproof-vps", permanent: false },
      { source: "/dedicated", destination: "/plans?tab=dedicated", permanent: false },
      { source: "/domains", destination: "/plans?tab=bulletproof-domains", permanent: false },
      { source: "/cdn", destination: "/plans?tab=cdn", permanent: false },
    ];
  },
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
