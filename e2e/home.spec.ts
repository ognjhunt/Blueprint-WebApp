import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Capture real sites\. Run the exact world model later\./i }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^Capture$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^For Robot Teams$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^For Sites$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download the app/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Browse world models/i }).first()).toBeVisible();
});
