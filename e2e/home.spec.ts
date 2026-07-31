import { test, expect } from '@playwright/test';

test('homepage leads with the single Task Evaluation Run story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Rank your candidates against a real site before you send one\./i,
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
  // Section 03 tells the lifecycle as the run film rather than a static rail, so
  // these assert the film's act copy. `.first()` because each caption appears
  // both on the stage and in the film's screen-reader act list.
  await expect(
    page.getByText(/You bring one real job at one real site/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/The capture becomes a testbed we version, pin, and maintain/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/the smallest gap this run could separate/i).first(),
  ).toBeVisible();

  // The two things a run never grants. Contract-enforced, so it is stated.
  await expect(page.getByText(/Deployment approval/i).first()).toBeVisible();
  await expect(page.getByText(/Safety certification/i).first()).toBeVisible();

  // Screening runs first and is the half that names a cause; the ordering
  // follows, carrying the resolution that makes it readable.
  await expect(page.getByText(/Some candidates the building will not take/i)).toBeVisible();
  await expect(page.getByText(/^Ruled out$/i).first()).toBeVisible();
  await expect(page.getByText(/Then the survivors get ranked, with the margin/i)).toBeVisible();
  await expect(page.getByText(/Tied at this rollout count/i).first()).toBeVisible();

  // Figures carrying schematic values are marked as illustrative.
  await expect(page.getByText(/^Illustrative$/i).first()).toBeVisible();
});
