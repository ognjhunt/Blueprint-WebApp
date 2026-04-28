import { test, expect } from '@playwright/test';

test('onboarding checklist page loads correctly', async ({ page }) => {
  await page.goto('/onboarding', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /Intake review hub/i }),
  ).toBeVisible();
});
