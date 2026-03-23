import { test, expect } from '@playwright/test';

test('world models page exposes hosted access and package paths', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Review the exact site before your team shows up\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Choose how you want access\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Start hosted session/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request scene package/i }).first()).toBeVisible();
});

test('hosted session CTA opens the setup flow', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  const hostedSessionLink = page.getByRole('link', { name: /Start hosted session/i }).first();
  await expect(hostedSessionLink).toBeVisible();
  await hostedSessionLink.click();

  await expect(page).toHaveURL(/\/world-models\/.+\/start/);
  await expect(
    page.getByRole('heading', { name: /Start Hosted Session/i }),
  ).toBeVisible();
});

test('direct navigation to a world-model detail page stays on the detail page', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Harborview Grocery Distribution Annex/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Use this listing to check deployment fit/i)).toBeVisible();
});
