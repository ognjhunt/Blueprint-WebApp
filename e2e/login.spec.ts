import { test, expect } from '@playwright/test';

test('login page renders core auth UI', async ({ page }) => {
  await page.goto('/sign-in');

  await expect(
    page.getByRole('heading', { name: /Sign In/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Access the Blueprint portal\./i),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Continue with Google/i }),
  ).toBeVisible();
});
