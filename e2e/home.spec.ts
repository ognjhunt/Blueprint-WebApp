import { test, expect } from '@playwright/test';

test('homepage leads with the single Task Evaluation Run story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Know what the real site will do to your robot\./i,
    }),
  ).toBeVisible();
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: /^For Robot Teams$/i })).toBeVisible();
  // Site operators are demoted out of the primary header nav to the footer.
  await expect(nav.getByRole('link', { name: /^For Site Operators$/i })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /^How it works$/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: /^For Site Operators$/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^Request a Task Evaluation Run$/i }).first()).toBeVisible();
  // The one-lifecycle story is carried by the run-lifecycle figure.
  await expect(
    page.locator('main').getByText(/From a stated decision to a bounded answer/i),
  ).toBeVisible();
  await expect(page.getByText(/^Pin the testbed$/i)).toBeVisible();
  await expect(page.getByText(/^Decide or abstain$/i)).toBeVisible();
  await expect(page.getByText(/^Name the next test$/i)).toBeVisible();
  await expect(page.getByText(/Five ways a run can end/i).first()).toBeVisible();
  await expect(page.getByText(/does not infer a winner from raw scores/i)).toBeVisible();
  // Figures label what they are, so nothing reads as a measured Blueprint result.
  await expect(page.getByText(/Conceptual ordering/i).first()).toBeVisible();
});
