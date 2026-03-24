import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Test your robot on the exact customer site before you travel\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Proof$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^About$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^FAQ$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open public demo/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Talk to Blueprint/i }).first()).toBeVisible();
});
