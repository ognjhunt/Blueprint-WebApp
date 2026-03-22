import { test, expect } from '@playwright/test';

test('legacy marketplace route redirects to world models', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/world-models$/);
  await expect(
    page.getByRole('heading', { name: /Train on the exact site you're deploying to\./i }),
  ).toBeVisible();
});
