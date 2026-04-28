import { test, expect } from '@playwright/test';

test('business signup onboarding flow loads first step', async ({ page }) => {
  await page.goto('/signup/capturer', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Buyer Access Request/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Request exact-site packages or hosted evaluation through a private, context-rich intake instead of a generic marketplace signup./i),
  ).toBeVisible();
});
