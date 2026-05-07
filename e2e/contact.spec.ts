import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Tell us the site, task, and robot in a few lines\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request site review', exact: true })).toBeVisible();
  await expect(page.getByText('For Robot Teams', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/a real place to inspect, compare, or request before deployment work moves forward/i),
  ).toBeVisible();
  await expect(page.getByText(/Short form first\. Call only when useful\./i)).toBeVisible();
  await expect(page.getByText(/Required first pass/i)).toBeVisible();
});
