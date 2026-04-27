import { test, expect } from '@playwright/test';

/**
 * Auth smoke: cold load of /login, sign in with the seeded admin, land
 * on the dashboard. If this regresses, every other route is broken too.
 */
test.describe('auth smoke', () => {
  test('admin can sign in and reach the dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/(en|ar)?\/?login/);

    await page.getByLabel(/email/i).fill('admin@wow.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/(en|ar)?\/?$/);
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('login form rejects bad credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@wow.local');
    await page.getByLabel(/password/i).fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Stays on the login page and surfaces an error.
    await expect(page).toHaveURL(/\/(en|ar)?\/?login/);
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
