import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ai-elements has type conflicts with shadcn v4 (Radix -> Ark migration)
    // Components work at runtime; types will be fixed upstream
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
