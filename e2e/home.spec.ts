import { test, expect } from '@playwright/test';

test('homepage leads with the KISS real-site robot eval dataset story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Real-site robot eval cards before the pilot\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^How it works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Proof$/i })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Request eval dataset/i }).first(),
  ).toBeVisible();
  await expect(
    page.locator('main').getByText(/Capture a real site\. Turn it into Site, Task, Scenario, and Eval Cards/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/^Success rate$/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /The card family for one real robot task\./i })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Public card samples show the workflow\. Request packets prove one site\./i,
    }),
  ).toBeVisible();
});
