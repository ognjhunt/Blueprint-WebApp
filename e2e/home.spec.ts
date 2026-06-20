import { test, expect } from '@playwright/test';

test('homepage leads with the simple capture-backed policy evaluation story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Evaluate robot policies before field time\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^Robot teams$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Sites$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Create evaluation run/i }).first()).toBeVisible();
  await expect(page.locator('main').getByText(/WAM\/VLA policy evaluations on captured real-site task packs/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Policy Evaluation Run$/i }).first()).toBeVisible();
  await expect(page.getByText(/100 \/ 500/i)).toBeVisible();
  await expect(page.getByText(/do not prove safety, deployment readiness, universal SRCC/i)).toBeVisible();
});
