import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility smoke. Runs axe-core against the public login page and
 * the post-login dashboard, asserting no WCAG 2.0 / 2.1 A or AA
 * violations. Keep the surface narrow — full coverage belongs in a
 * dedicated a11y job, but a hard floor on the two most-loaded URLs
 * catches regressions like missing labels and contrast drift fast.
 */
test.describe('a11y smoke', () => {
  test('/login is WCAG 2.1 AA clean', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('dashboard (post-login) is WCAG 2.1 AA clean', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@wow.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(en|ar)?\/?$/);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
