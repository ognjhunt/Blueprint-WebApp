import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture');

  await expect(
    page.getByRole('heading', { name: /Get paid to walk through buildings\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Use your phone or smart glasses to capture indoor spaces/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Download the app/i }).first()).toBeVisible();
});
