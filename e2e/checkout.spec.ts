import { test, expect } from '@playwright/test';

test('old world models checkout flag lands on the sites catalog', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/sites\?checkout=success$/);
  await expect(
    page.getByRole('heading', { name: /Evaluate where the work happens\./i }),
  ).toBeVisible();
});
