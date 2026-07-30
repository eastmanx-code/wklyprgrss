import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos arrive already compressed to ~300KB; this is headroom, not a target.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
