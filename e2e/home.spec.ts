import { test, expect } from '@playwright/test';
import { worldModelDefinition } from '../client/src/data/marketingDefinitions';

test('homepage leads with capture and world models', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Test the exact site before deployment\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^World Models$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Hosted Evaluation$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^How It Works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Trust$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Inspect a real site/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Request hosted evaluation/i }).first()).toBeVisible();
  await expect(page.locator('body')).toContainText("What's public now");
  await expect(page.getByText(/Hosted evaluation scoping/i)).toBeVisible();
  await expect(page.getByText(worldModelDefinition)).toBeVisible();
});
