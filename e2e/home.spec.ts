import { test, expect } from '@playwright/test';

test('homepage leads with the KISS readiness story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Know what breaks before the robot pilot\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^How it works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Proof$/i })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Request readiness/i }).first(),
  ).toBeVisible();
  await expect(
    page.locator('main').getByText(/one real facility, one robot task, and one pass bar/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/^Success rate$/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Three ways to start\./i })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Public samples show the product shape\. Request packets prove one site\./i,
    }),
  ).toBeVisible();
});
