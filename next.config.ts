import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/tarkov-helper',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;