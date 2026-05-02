import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Tell us the site, task, and robot in a few lines\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Request site review/i })).toBeVisible();
  await expect(page.getByText('For Robot Teams', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/one exact site for evaluation, site-specific data, release comparison, or package access/i),
  ).toBeVisible();
  await expect(page.getByText(/Short form first\. Call only when useful\./i)).toBeVisible();
  await expect(page.getByText(/Useful to include/i)).toBeVisible();
});
