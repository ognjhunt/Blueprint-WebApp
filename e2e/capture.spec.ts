import { test, expect } from '@playwright/test';

test('capture page keeps assignments tied to real review and city status', async ({ page }) => {
  await page.goto('/capture', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { name: /^Capture real sites for robot evaluation\.$/i }),
  ).toBeVisible();
  await expect(page.getByText(/Blueprint publishes assignments only after review/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply to capture/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Check city status/i }).first()).toHaveAttribute(
    'href',
    /capture-app\/launch-access/,
  );
  await expect(page.getByText(/No public payout promises/i)).toBeVisible();
});
