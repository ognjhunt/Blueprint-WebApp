import { test, expect } from '@playwright/test';

test('world models page exposes hosted access and package paths', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Train, evaluate, and debug on the exact site before deployment\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Choose how you want access\./i)).toBeVisible();
  await expect(page.getByRole('link', { name: /How access works/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /See available sites/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Request hosted evaluation/i }).first()).toBeVisible();
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
    page.getByText(
      /Use it to answer a deployment question on the real site, compare the package with hosted evaluation, and decide how your team should test before visiting\./i,
    ),
  ).toBeVisible();
  await expect(page.getByText(/session-hour is one hour of self-serve hosted runtime/i)).toBeVisible();
});
