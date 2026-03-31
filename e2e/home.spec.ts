import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Train your robot on the exact customer site before you visit\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Deliverables$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^About$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /View sample listing/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request hosted evaluation/i }).first()).toBeVisible();
  await expect(page.getByText(/a world model is a site-specific digital environment/i)).toBeVisible();
});
