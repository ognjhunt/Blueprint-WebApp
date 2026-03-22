import { test, expect } from '@playwright/test';

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact');

  await expect(
    page.getByRole('heading', { name: /Tell us the site, the task, and what you want to unlock\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Capture \+ World Models/i)).toBeVisible();
  await expect(page.getByText(/capture supply, world-model access, and the right commercial path/i)).toBeVisible();
});
