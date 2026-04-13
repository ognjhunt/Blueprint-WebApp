import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Capture for Blueprint starts in the app\./i }),
  ).toBeVisible();
  await expect(page.getByText(/If you are recording a site for Blueprint, use the mobile app handoff below\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open capture app/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply for capturer access/i }).first()).toBeVisible();
});
