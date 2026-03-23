import { test, expect } from '@playwright/test';

test('login page renders core auth UI', async ({ page }) => {
  await page.goto('/sign-in');

  await expect(
    page.getByRole('heading', { name: /Sign in to the web portal/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/This route is for robot teams and site operators using the web product\./i),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Continue with Google/i }),
  ).toBeVisible();
});
