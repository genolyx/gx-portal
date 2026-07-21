import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gx-portal/types'],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
