import { test, expect } from '@playwright/test';

test('world models page remains reachable with checkout success flag', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Sites your robot team can inspect\./i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Browse current samples and request the place you need\./i),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Request access/i }).first(),
  ).toBeVisible();
});
