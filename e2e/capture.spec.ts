import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture');

  await expect(
    page.getByRole('heading', { name: /Capture for Blueprint starts in the app\./i }),
  ).toBeVisible();
  await expect(page.getByText(/The main website is for robot teams buying access to real sites\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open capture app/i }).first()).toBeVisible();
});
