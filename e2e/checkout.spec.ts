import { test, expect } from '@playwright/test';

test('world models page remains reachable with checkout success flag', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Browse exact-site world models\./i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Start from public samples, request-gated profiles, or planned catalog lanes/i),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Request world model/i }).first(),
  ).toBeVisible();
});
