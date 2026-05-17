import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(rootDir, "../.."),
  transpilePackages: ["@dior/backend", "@dior/database", "@dior/shared"],
  async redirects() {
    return [
      { source: "/vps", destination: "/services", permanent: false },
      { source: "/vps/new", destination: "/plans?tab=bulletproof-vps", permanent: false },
      { source: "/dedicated", destination: "/plans?tab=dedicated", permanent: false },
      { source: "/domains", destination: "/plans?tab=bulletproof-domains", permanent: false },
      { source: "/cdn", destination: "/plans?tab=cdn", permanent: false },
    ];
  },
  experimental: {
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
