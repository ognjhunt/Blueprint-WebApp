import { test, expect } from '@playwright/test';

test('business signup onboarding flow loads first step', async ({ page }) => {
  await page.goto('/signup');

  await expect(
    page.getByRole('heading', { name: /Create your Blueprint account/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Account basics/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Continue with Google/i }),
  ).toBeVisible();
});
