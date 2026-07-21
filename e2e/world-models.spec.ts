import { test, expect } from '@playwright/test';

test('world models catalog route redirects to the Sites library', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Evaluate where the work happens\./i }),
  ).toBeVisible();
});

test('world-model detail route redirects to the live Sites library', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Evaluate where the work happens/i }),
  ).toBeVisible();
});

test('legacy hosted setup does not expose a fixture site', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01/start', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Evaluate where the work happens/i }),
  ).toBeVisible();
});
