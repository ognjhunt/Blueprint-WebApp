import { test, expect } from '@playwright/test';

test('business signup flow loads first step', async ({ page }) => {
  await page.goto('/signup/business', { waitUntil: 'networkidle' });

  // Step 1 heading should be visible
  await expect(
    page.getByRole('heading', { name: /Create an account/i }),
  ).toBeVisible();
});

test('site-operator signup defers the dossier and permissions to the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup/business?buyerType=site_operator&intent=pilot-opportunity');
  await page.getByLabel('Work email', { exact: true }).fill('operator@siteco.example');
  await page.getByLabel('Password', { exact: true }).fill('strongpass123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set up your workspace', exact: true })).toBeVisible();
  await page.getByLabel('Your name', { exact: true }).fill('Jordan Lee');
  await page.getByLabel('Organization', { exact: true }).fill('SiteCo Operations');
  await expect(page.getByLabel('Find a robot for my site')).toBeChecked();
  await expect(page.getByText(/Capture details and permissions are set in your workspace/)).toBeVisible();
  await expect(page.getByText(/Progressive access|Standardized benchmark|Requested lane/)).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
