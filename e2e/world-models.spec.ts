import { test, expect } from '@playwright/test';

test('world models catalog route redirects to the proof explainer', async ({ page }) => {
  await page.goto('/world-models', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/proof$/);
  await expect(
    page.getByRole('heading', { name: /See what supports the readiness estimate\./i }),
  ).toBeVisible();
});

test('world-model detail route redirects to proof while hosted setup remains direct', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/proof$/);
  await expect(
    page.getByRole('heading', { name: /The public packet teaches the workflow/i }),
  ).toBeVisible();
});

test('direct navigation to the setup flow stays reachable', async ({ page }) => {
  await page.goto('/world-models/sw-chi-01/start', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/world-models\/sw-chi-01\/start$/);
  await expect(
    page.getByRole('heading', { name: /Site World Run/i }),
  ).toBeVisible();
});
