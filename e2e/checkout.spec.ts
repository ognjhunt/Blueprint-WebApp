import { test, expect } from '@playwright/test';

test('world models page remains reachable with checkout success flag', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Exact-site worlds\./i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Browse real facilities\./i),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Request access/i }).first(),
  ).toBeVisible();
});
