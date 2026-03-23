import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Inspect the exact site before your team books the visit\./i }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Results$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^FAQ$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open public demo/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Browse world models/i }).first()).toBeVisible();
});
