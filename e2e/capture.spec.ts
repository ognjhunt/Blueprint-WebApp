import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Capture real places only where Blueprint has opened access\./i }),
  ).toBeVisible();
  await expect(page.getByText(/If you can record public-facing places, start here\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Check capture access/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply for capturer access/i }).first()).toBeVisible();
});
