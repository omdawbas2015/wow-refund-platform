/**
 * Next.js 15 instrumentation hook.
 *
 * Loads Sentry's Node or edge SDK depending on the runtime, but only
 * when SENTRY_DSN is set. Without a DSN nothing is imported and the
 * function returns immediately.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
