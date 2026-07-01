import { test, expect } from '@playwright/test';

test('homepage leads with the simple capture-backed policy evaluation story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Test robot policies before field time\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^For Robot Teams$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^For Site Operators$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^How it works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Request evaluation$/i }).first()).toBeVisible();
  await expect(
    page.locator('main').getByText(/Compare your policy against earlier checkpoints/i),
  ).toBeVisible();
  await expect(page.getByText(/Capture the site/i)).toBeVisible();
  await expect(page.getByText(/Run the comparison/i)).toBeVisible();
  await expect(page.getByText(/Decide the next test/i).first()).toBeVisible();
  await expect(page.getByText(/500 episodes/i).first()).toBeVisible();
  await expect(page.getByText(/policy-ranking result outside the measured evaluation scope/i)).toBeVisible();
});
