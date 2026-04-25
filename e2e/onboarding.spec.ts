import { test, expect } from '@playwright/test';

test('business signup onboarding flow loads first step', async ({ page }) => {
  await page.goto('/signup');

  await expect(
    page.getByRole('heading', { name: /Request exact-site access/i }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Use this path when your team needs a site-specific world-model package, hosted review, or private buyer workflow grounded in one real facility\./i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Open buyer request/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Book a scoping call/i }),
  ).toBeVisible();
});
