/**
 * Sentry edge SDK init for middleware + edge route handlers.
 * No-op when SENTRY_DSN is unset.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACE_RATE ?? 0.1),
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? undefined,
  });
}
