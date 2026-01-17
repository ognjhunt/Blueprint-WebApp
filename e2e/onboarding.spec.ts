import { test, expect } from '@playwright/test';

test('business signup onboarding flow loads first step', async ({ page }) => {
  await page.goto('/signup');

  await expect(
    page.getByRole('heading', { name: /Welcome to Blueprint/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Account Basics/i }),
  ).toBeVisible();
});
