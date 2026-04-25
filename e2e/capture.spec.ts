import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Capture starts in the app\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Blueprint's main site is for buyers inspecting exact-site world models\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open capture app/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply for capturer access/i }).first()).toBeVisible();
});
