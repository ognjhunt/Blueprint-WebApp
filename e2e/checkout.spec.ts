import { test, expect } from '@playwright/test';

test('marketplace checkout success banner appears with success flag', async ({ page }) => {
  await page.goto('/marketplace?checkout=success');

  await expect(
    page.getByRole('heading', { name: /Purchase Successful!/i }),
  ).toBeVisible();
});
