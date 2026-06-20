import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["undici", "youtubei.js", "youtube-transcript"],
  experimental: {
    proxyTimeout: 300000,
  },
};

export default nextConfig;
