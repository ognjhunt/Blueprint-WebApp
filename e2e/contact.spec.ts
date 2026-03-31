import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact');

  await expect(
    page.getByRole('heading', { name: /Tell us the site, task, and robot in a few lines\./i }),
  ).toBeVisible();
  await expect(page.getByText(/What happens after you send this/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore world models/i })).toBeVisible();
});
