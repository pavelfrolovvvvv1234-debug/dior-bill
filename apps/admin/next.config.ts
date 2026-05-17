import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dior/backend", "@dior/database", "@dior/shared"],
};

export default nextConfig;
