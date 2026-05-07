import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Blueprint turns real places into sites your robot team can inspect\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^For robot teams$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^For site operators$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^For capturers$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Sites to inspect$/i })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Request site review$/i }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Submit or claim a site/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Check capture access/i }).first()).toBeVisible();
  await expect(page.getByText(/One real site\. One robot question\. Proof stays attached\./i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Start with the site your robot needs to understand\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Browse sample sites/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Start with one complete proof journey\./i })).toBeVisible();
});
