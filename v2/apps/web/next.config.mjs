import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
