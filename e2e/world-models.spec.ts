import { test, expect } from '@playwright/test';

test('world models catalog route redirects to the Sites library', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Pick a captured place\./i }),
  ).toBeVisible();
});

test('world-model detail route redirects to the matching site detail while hosted setup remains direct', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/sites\/sw-chi-01$/);
  await expect(
    page.getByText(/Harborview Grocery Distribution Annex/i).first(),
  ).toBeVisible();
});

test('direct navigation to the setup flow stays reachable', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01/start', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/world-models\/sw-chi-01\/start$/);
  await expect(
    page.getByRole('heading', { name: /Policy Evaluation Set/i }),
  ).toBeVisible();
});
