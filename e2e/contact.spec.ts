import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Request a site, location, or robot workflow\./i }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder('What site, location, or robot workflow do you need?'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Request this location/i }).first()).toBeVisible();
  await expect(
    page.getByText(/World model package/i).first(),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: /Hosted review/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /New capture request/i })).toBeVisible();
  await expect(page.getByText(/Required first pass/i)).toBeVisible();
  await expect(page.getByText(/Proof boundaries visible/i)).toHaveCount(0);
});
