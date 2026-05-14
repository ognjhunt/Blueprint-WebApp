import { test, expect } from '@playwright/test';

test('world models page exposes hosted access and package paths', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Browse exact-site world models\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Blueprint is building a capture-backed supply of site worlds/i)).toBeVisible();
  await expect(page.getByText(/Marketplace filters/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Inspect listing/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Package access/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Start with a site world, not an abstract demo\./i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Built from real capture\./i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Ask for the exact site your robot team needs\./i })).toBeVisible();
});

test('direct navigation to the setup flow stays reachable', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01/start', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/world-models\/sw-chi-01\/start$/);
  await expect(
    page.getByRole('heading', { name: /Configure Hosted Evaluation/i }),
  ).toBeVisible();
});

test('direct navigation to a world-model detail page stays on the detail page', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01', { waitUntil: 'networkidle' });

  // Check that page loads with a heading
  await expect(
    page.getByRole('heading', { level: 1 }),
  ).toBeVisible();
  
  // Check for visible text that should always be present
  await expect(page.getByText(/Visible now/i)).toBeVisible();
  await expect(page.getByText(/Request package access/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Check hosted setup/i }).first()).toBeVisible();
});
