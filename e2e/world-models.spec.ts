import { test, expect } from '@playwright/test';

test('world models page exposes hosted access and package paths', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Find the indoor world model your robot team needs\./i }),
  ).toBeVisible();
  const search = page.getByPlaceholder(/Search an address, site, city, store type, workflow, or robot task/i);
  await expect(search).toBeVisible();
  await expect(page.getByText(/Exact catalog match/i).first()).toBeVisible();
  await expect(page.getByText(/Nearby\/closest match/i).first()).toBeVisible();
  await expect(page.getByText(/Category\/workflow match/i).first()).toBeVisible();
  await expect(page.getByText(/Request candidate/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Open sample world model/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request package access|Scope package/i }).first()).toBeVisible();

  await search.fill('Whole Foods');
  await expect(page.getByRole('option', { name: /whole foods/i })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/No scanned package for this exact place yet/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request this location/i }).first()).toHaveAttribute(
    'href',
    /buyerType=robot_team/,
  );
});

test('unknown world-model location becomes a request candidate', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  const search = page.getByPlaceholder(/Search an address, site, city, store type, workflow, or robot task/i);
  await search.fill('123 New Robot Ave, Austin, TX');
  await page.keyboard.press('Enter');

  await expect(page.getByText(/No scanned package for this exact place yet/i).first()).toBeVisible();
  const request = page.getByRole('link', { name: /Request this location/i }).first();
  await expect(request).toBeVisible();
  await expect(request).toHaveAttribute('href', /source=site-worlds/);
  await expect(request).toHaveAttribute('href', /siteLocation=123\+New\+Robot\+Ave/);
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
  await expect(page.getByText('Visible now', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Request package access/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Check hosted review/i }).first()).toBeVisible();
});
