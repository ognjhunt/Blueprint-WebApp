import { test, expect } from '@playwright/test';
test('site signup is open without an invitation or staff approval', async ({ page }) => {
  await page.goto('/signup/business');
  await expect(page.getByRole('heading', { name: 'Create an account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Work email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
test('site signup creates no invitation or screening step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup/business?buyerType=site_operator&intent=pilot-opportunity');
  await expect(page.getByRole('heading', { name: 'Create an account', exact: true })).toBeVisible();
  await page.getByLabel('Work email').fill('owner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('strongpass123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set up your workspace' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
});
