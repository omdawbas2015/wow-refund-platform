/**
 * Sentry browser SDK init.
 *
 * Activates only when SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set, so
 * dev / preview environments without a DSN behave as if Sentry isn't
 * installed at all. No DSN means no network calls, no session replay,
 * no breadcrumbs.
 */
import * as Sentry from '@sentry/nextjs';

const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? undefined,
  });
}
