import { test, expect } from '@playwright/test';

test('login page renders core auth UI', async ({ page }) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: /Welcome back/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Continue with Google/i }),
  ).toBeVisible();
});
