import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Site-specific world models for real facilities\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Hosted Evaluation$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^How It Works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Trust$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Explore Sites$/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^Request Access$/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /One exact site\. Two buying paths\./i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /See what a team gets before it commits\./i })).toBeVisible();
});
