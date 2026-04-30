import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ai-elements has type conflicts with shadcn v4 (Radix -> Ark migration)
    // Components work at runtime; types will be fixed upstream
    ignoreBuildErrors: true,
  },
  // agentmail SDK has an optional dependency on @x402/fetch (crypto payments)
  // that we don't use. Marking it as external prevents build failures.
  serverExternalPackages: ['agentmail'],
};

export default nextConfig;
