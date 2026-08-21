import { test, expect } from '@playwright/test';

test('business signup flow loads first step', async ({ page }) => {
  await page.goto('/signup/business', { waitUntil: 'networkidle' });

  // Step 1 heading should be visible
  await expect(
    page.getByRole('heading', { name: /Organization details/i }),
  ).toBeVisible();
});

test('site-operator pilot path reaches the private dossier and permission controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/signup/business?buyerType=site_operator&intent=pilot-opportunity',
    { waitUntil: 'networkidle' },
  );

  await page.getByLabel(/Organization name/i).fill('SiteCo Operations');
  await page.getByLabel(/Work email/i).fill('operator@siteco.example');
  await page.getByLabel(/^Password$/i).fill('strongpass123');
  await page.getByLabel(/Confirm password/i).fill('strongpass123');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  await expect(page.getByRole('heading', { name: /Role and site lane/i })).toBeVisible();
  await page.getByLabel(/Your name/i).fill('Jordan Lee');
  await page.getByLabel(/Company size/i).selectOption('51-200');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  await expect(page.getByRole('heading', { name: /Site boundary intake/i })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /Prepare this workflow as a pilot opportunity/i }),
  ).toBeChecked();
  await expect(page.getByText(/Progressive access/i)).toBeVisible();
  await expect(page.getByLabel(/Standardized benchmark/i)).toBeVisible();
  await expect(page.getByLabel(/Adapt for this site/i)).toHaveValue('not_granted');
  await expect(page.getByLabel(/General model training/i)).toHaveValue('not_granted');
  await expect(page.getByText(/receive results, not unrestricted twin files/i)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
