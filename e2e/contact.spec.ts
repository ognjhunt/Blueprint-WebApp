import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Request the site-specific world model your robot team needs\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request world model', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Commercial Intake', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/site-specific world model package/i),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: /Hosted review/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Capture access/i })).toBeVisible();
  await expect(page.getByText(/Short form first\. Call only when useful\./i)).toBeVisible();
  await expect(page.getByText(/Required first pass/i)).toBeVisible();
});
