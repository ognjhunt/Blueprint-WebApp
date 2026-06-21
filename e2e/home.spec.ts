import { test, expect } from '@playwright/test';

test('homepage leads with the simple capture-backed policy evaluation story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Test robot policies before field time\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^Evaluate$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Sites$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Proof$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Start$/i }).first()).toBeVisible();
  await expect(page.locator('main').getByText(/Use captured real-site tasks to see what works/i)).toBeVisible();
  await expect(page.getByText(/Capture site/i)).toBeVisible();
  await expect(page.getByText(/Run policies/i)).toBeVisible();
  await expect(page.getByText(/Pick winner/i)).toBeVisible();
  await expect(page.getByText(/100 episodes/i)).toBeVisible();
  await expect(page.getByText(/do not approve deployment, safety, or guaranteed real-world success/i)).toBeVisible();
});
