import { test, expect } from '@playwright/test';

test('world models page exposes hosted access and package paths', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Browse exact-site world models\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Real facilities, real capture, and clear paths into site packages or hosted sessions\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /View Sample Site/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request Access/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Featured sites\./i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Browse the catalog\./i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Need a specific site\?/i })).toBeVisible();
});

test('direct navigation to the setup flow stays reachable', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01/start', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/world-models\/sw-chi-01\/start$/);
  await expect(
    page.getByRole('heading', { name: /Configure Hosted Evaluation/i }),
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
  await expect(
    page.getByText(/What a buyer can inspect right now\./i),
  ).toBeVisible();
  await expect(page.getByText(/Typical response cadence/i)).toBeVisible();
  await expect(page.getByText(/Hosted evaluation evidence/i)).toBeVisible();
  await expect(page.getByText(/Current evidence tied to this listing/i)).toBeVisible();
});
