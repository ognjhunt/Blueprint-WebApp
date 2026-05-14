import { test, expect } from '@playwright/test';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Site-specific world models built from real capture\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^Product$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^World models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Capture$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Proof$/i })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Request world model$/i }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Submit or claim a site/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Check capture access/i }).first()).toBeVisible();
  await expect(page.getByText(/The product is not a generic scene library/i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Start with the exact site your robot needs to understand\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Browse world models/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /The proof travels with the product\./i })).toBeVisible();
});
