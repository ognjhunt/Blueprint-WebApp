import { test, expect } from '@playwright/test';

test('homepage leads with the single Task Evaluation Run story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Answer it before you send a robot\./i,
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

  // One service, and the lifecycle behind it.
  await expect(
    page.locator('main').getByText(/One service\. Priced per decision\./i),
  ).toBeVisible();
  await expect(page.getByText(/^Bring one real task$/i)).toBeVisible();
  await expect(page.getByText(/^We build the testbed$/i)).toBeVisible();
  await expect(page.getByText(/^You get an answer with its limits$/i)).toBeVisible();

  // Declining to decide is stated on the page, not implied.
  await expect(page.getByText(/A run is allowed to tell you it cannot tell you/i)).toBeVisible();
  await expect(page.getByText(/^Not yet$/i).first()).toBeVisible();
  await expect(page.getByText(/is not reported as one/i)).toBeVisible();

  // Figures carrying schematic values are marked as illustrative.
  await expect(page.getByText(/^Illustrative$/i).first()).toBeVisible();
});
