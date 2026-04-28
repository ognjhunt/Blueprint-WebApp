import { test, expect } from '@playwright/test';

test('business signup flow loads first step', async ({ page }) => {
  await page.goto('/signup/business', { waitUntil: 'networkidle' });

  // Step 1 heading should be visible
  await expect(
    page.getByRole('heading', { name: /Organization details/i }),
  ).toBeVisible();
});
