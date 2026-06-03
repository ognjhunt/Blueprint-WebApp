import { test, expect } from '@playwright/test';

test('old world models checkout flag lands on the proof explainer', async ({ page }) => {
  await page.goto('/world-models?checkout=success', { waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/proof\?checkout=success$/);
  await expect(
    page.getByRole('heading', { name: /See what supports the readiness estimate\./i }),
  ).toBeVisible();
});
