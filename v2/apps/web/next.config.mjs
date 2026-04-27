import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'standalone' emits .next/standalone with a minimal node_modules tree
  // and a self-contained server.js — required for the Docker / K8s
  // image to stay slim (~150MB vs ~1.5GB with the full pnpm store).
  output: 'standalone',
  transpilePackages: ['@wow/ui', '@wow/validators', '@wow/db'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
