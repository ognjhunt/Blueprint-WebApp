import { test, expect } from '@playwright/test';

test('world-model checkout success banner appears with success flag', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(
    page.getByText(/Purchase successful/i),
  ).toBeVisible();
  await expect(
    page.getByText(/keep browsing world models/i),
  ).toBeVisible();
});
