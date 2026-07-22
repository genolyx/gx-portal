import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gx-portal/types'],
  async rewrites() {
    // Server-side proxy target (not exposed to browser)
    const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
