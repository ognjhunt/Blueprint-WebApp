import { test, expect } from '@playwright/test';

test('legacy marketplace route now returns the site 404 page', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(page.getByRole('heading', { name: /Page not found/i })).toBeVisible();
});
