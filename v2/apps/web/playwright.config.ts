import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * Playwright smoke suite for the v2 Next.js app.
 *
 * The local default assumes `pnpm dev` is running on port 3000 (or the
 * env var override). CI should `pnpm db:migrate:deploy` and seed first,
 * then run `pnpm playwright install --with-deps chromium` once before
 * `pnpm test:e2e`.
 *
 * The suite is intentionally minimal — it exercises the auth flow plus
 * a couple of post-login URLs to catch regressions in the boot path,
 * not full feature coverage.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
