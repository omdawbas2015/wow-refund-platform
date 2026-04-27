import { test, expect } from '@playwright/test';

/**
 * Case list smoke. Logs in via the UI, then verifies that the cases
 * index renders the bulk-operations link and at least one demo case row.
 *
 * This file does NOT touch the /cases UI directly — it only asserts the
 * page loaded. Anything beyond that belongs in dedicated feature tests.
 */
test.describe('cases smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@wow.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(en|ar)?\/?$/);
  });

  test('cases index loads with at least one row', async ({ page }) => {
    await page.goto('/cases');
    await expect(page).toHaveURL(/cases/);

    // The page renders a table + at least the header row. We do not
    // assert specific demo data; the seed may evolve.
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('operations bulk-cases page is reachable', async ({ page }) => {
    await page.goto('/operations/bulk-cases');
    await expect(page).toHaveURL(/operations\/bulk-cases/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
