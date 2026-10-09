import { test, expect } from '@playwright/test';
test('account requests start with intake and approval', async ({ page }) => {
  await page.goto('/signup/business');
  await expect(page.getByRole('heading', { name: 'Access by invitation', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Show us a task/ })).toHaveAttribute('href', '/contact/site-operator');
  await expect(page.getByRole('link', { name: /Register robot-team interest/ })).toHaveAttribute('href', '/contact/robot-team');
});
test('site query parameters cannot open registration before approval', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup/business?buyerType=site_operator&intent=pilot-opportunity');
  await expect(page.getByRole('heading', { name: 'Access by invitation', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
});
