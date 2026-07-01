import { test, expect } from '@playwright/test';

test('capture page sells contributor-side capture supply', async ({ page }) => {
  await page.goto('/capture', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /^Capture Jobs$/i }),
  ).toBeVisible();
  await expect(page.getByText(/Get paid to capture real sites for robot evaluation\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Browse capture jobs/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply or join waitlist/i }).first()).toBeVisible();
});
