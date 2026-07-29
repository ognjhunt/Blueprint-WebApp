import { test, expect } from '@playwright/test';

test('homepage leads with the single Task Evaluation Run story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Turn a real site-task into a decision you can defend\./i,
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
  await expect(
    page.locator('main').getByText(/One lifecycle from task to maintained evidence/i),
  ).toBeVisible();
  await expect(page.getByText(/^Real site-task$/i)).toBeVisible();
  await expect(page.getByText(/^Maintained testbed$/i)).toBeVisible();
  await expect(page.getByText(/^Decision or abstention$/i)).toBeVisible();
  await expect(page.getByText(/A useful run does not have to name a winner/i)).toBeVisible();
  await expect(page.getByText(/does not infer a winner from raw scores/i)).toBeVisible();
});
