import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { auth } from './auth-edge';

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/set-password',
  '/reset-password',
];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip middleware for API routes and assets
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Run next-intl first to handle locale prefix
  const intlResponse = intlMiddleware(req);

  // Determine if this path is public (auth pages)
  const cleanPath = stripLocale(pathname);
  const isPublic = PUBLIC_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`));

  // Check authentication
  const session = await auth();

  if (!session?.user) {
    if (!isPublic) {
      const loginUrl = new URL('/login', req.nextUrl.origin);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return intlResponse;
  }

  // If authenticated user needs to set a password, force them to /set-password
  if (session.user.mustChangePassword && cleanPath !== '/set-password') {
    return NextResponse.redirect(new URL('/set-password', req.nextUrl.origin));
  }

  // If they're authenticated and visit login/signup, bounce to dashboard
  if (isPublic && cleanPath !== '/set-password') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
