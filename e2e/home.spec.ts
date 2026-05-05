import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Site-specific world models for real places\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Hosted Evaluation$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^How It Works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Trust$/i })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Scope hosted review$|^Request site review$/i }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /See hosted path/i }).first()).toBeVisible();
  await expect(page.getByText(/One exact site\. One workflow\. Proof stays attached\./i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Start with the site your robot needs to understand\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /View sample deliverables/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Start with one complete proof journey\./i })).toBeVisible();
});
