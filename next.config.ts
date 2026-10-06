import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  output: 'export',
  basePath: isProd ? '/tarkov-helper' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
