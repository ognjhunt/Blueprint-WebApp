import { test, expect } from '@playwright/test';

test('legacy marketplace route now returns the site 404 page', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(page.getByRole('heading', { name: /Page not found/i })).toBeVisible();
});

test('legacy environments route redirects to the world models catalog', async ({ page }) => {
  await page.goto('/environments');

  await expect(page).toHaveURL(/\/world-models$/);
  await expect(
    page.getByRole('heading', { name: /Find the site before your team books the visit\./i }),
  ).toBeVisible();
});
